import { act, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Component, type ReactNode, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createForms,
  type FieldApi,
  type FieldRef,
  type FocusTarget,
  useDisabledErrors,
  useFieldRef,
  useFormContext,
  useFormState,
} from "./index.js";
import { settle } from "./test/helpers.js";

function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps()} />
    </label>
  );
}

const forms = createForms({ fields: { TextField } });
const required = (value: string) => (value === "" ? { message: "required" } : undefined);

const saved: { value: unknown; intent: unknown }[] = [];
const account = forms.define({
  defaultValues: { name: "", email: "", code: "" },
  validate: { fields: { name: required, email: required, code: required } },
  disabled: { code: true },
  onSubmit: (value, ctx: { intent: "save" | "publish" | undefined }) => {
    saved.push({ value, intent: ctx.intent });
    return "ok";
  },
});
type AccountForm = ReturnType<typeof account.useForm>;
const holder: { form?: AccountForm } = {};
const current = (): AccountForm => {
  if (holder.form === undefined) throw new Error("no form rendered");
  return holder.form;
};

function SubmitButton() {
  const form = useFormContext();
  const submitting = useFormState(form, (snapshot) => snapshot.submitting);
  const status = useFormState(form, (snapshot) => snapshot.submission.status);
  return (
    <>
      <button type="submit" disabled={submitting}>
        Save
      </button>
      <p data-testid="status">{status}</p>
    </>
  );
}

function DisabledErrors() {
  const form = account.useFormContext();
  const disabled = useDisabledErrors(form);
  return <p data-testid="disabled">{disabled.map((entry) => `${entry.name}: ${entry.errors[0]?.message}`).join(";")}</p>;
}

function Account(props: { readonly focusOnInvalid?: (target: FocusTarget) => void; readonly id?: string }) {
  const form = account.useForm({
    ...(props.focusOnInvalid === undefined ? {} : { focusOnInvalid: props.focusOnInvalid }),
    ...(props.id === undefined ? {} : { id: props.id }),
  });
  useEffect(() => {
    holder.form = form;
  });
  return (
    <form.Form>
      {({ submit, ...formProps }) => (
        <form aria-label="account" {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <form.TextField name="code" label="Code" />
          <SubmitButton />
          <button type="button" onClick={() => void submit("publish")}>
            Publish
          </button>
          <DisabledErrors />
        </form>
      )}
    </form.Form>
  );
}

const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);

describe("submit", () => {
  it("submits through formProps.onSubmit and with an intent", async () => {
    saved.length = 0;
    render(<Account />);
    const user = userEvent.setup();
    act(() => current().root.at("code").setDisabled(false));
    await user.type(input("Name"), "Ada");
    await user.type(input("Email"), "ada@example.com");
    await user.type(input("Code"), "42");
    await user.click(screen.getByText("Save"));
    await act(settle);
    expect(saved).toEqual([{ value: { name: "Ada", email: "ada@example.com", code: "42" }, intent: undefined }]);
    expect(screen.getByTestId("status").textContent).toBe("succeeded");
    await user.click(screen.getByText("Publish"));
    await act(settle);
    expect(saved[saved.length - 1]?.intent).toBe("publish");
  });

  it("focuses the first invalid field after an invalid submit", async () => {
    render(<Account />);
    const user = userEvent.setup();
    await user.type(input("Name"), "Ada");
    await user.click(screen.getByText("Save"));
    await act(settle);
    expect(screen.getByTestId("status").textContent).toBe("invalid");
    expect(document.activeElement).toBe(input("Email"));
    expect(input("Email").getAttribute("aria-invalid")).toBe("true");
  });

  it("focuses the form element and lists disabled errors when only disabled fields are invalid", async () => {
    render(<Account />);
    const user = userEvent.setup();
    await user.type(input("Name"), "Ada");
    await user.type(input("Email"), "ada@example.com");
    await act(() => current().handleSubmit());
    expect(document.activeElement).toBe(screen.getByRole("form", { name: "account" }));
    expect(screen.getByTestId("disabled").textContent).toBe("code: required");
    act(() => current().store.reset());
    expect(screen.getByTestId("disabled").textContent).toBe("");
  });

  it("calls a custom focusOnInvalid instead of focusing", async () => {
    const targets: FocusTarget[] = [];
    render(<Account focusOnInvalid={(target) => targets.push(target)} />);
    await act(async () => {
      await current().submit("save");
    });
    expect(targets).toHaveLength(1);
    const target = targets[0];
    expect(target?.field).toBe(current().root.at("name"));
    expect(target?.element).toBe(input("Name"));
    expect(target?.disabled.map((entry) => entry.name)).toEqual(["code"]);
    expect(document.activeElement).toBe(document.body);
  });

  it("uses an id from useId by default and the given id when there is one", () => {
    const { unmount } = render(<Account />);
    const generated = current().id;
    expect(screen.getByRole("form").id).toBe(generated);
    expect(input("Name").id).toBe(`${generated}--name`);
    unmount();
    render(<Account id="acct" />);
    expect(screen.getByRole("form").id).toBe("acct");
    expect(input("Name").id).toBe("acct--name");
  });
});

// A dialog form mounted inside another form's tree. Each typed reader finds its own form.
const note = forms.define({ defaultValues: { text: "" } });

function NoteBody() {
  const inner = note.useFormContext();
  const outer = account.useFormContext();
  const nearest = useFormContext();
  return (
    <>
      <inner.TextField name="text" label="Note" />
      <p data-testid="ids">{[inner.id, outer.id, nearest.id].join(" ")}</p>
    </>
  );
}

function NoteDialog() {
  const dialog = note.useForm({ id: "note" });
  return (
    <dialog.Form>
      <NoteBody />
    </dialog.Form>
  );
}

function Page() {
const form = account.useForm({ id: "outer" });
return (
  <form.Form>
    {(props) => (
      <form {...props}>
        <NoteDialog />
      </form>
    )}
  </form.Form>
);
}

class Boundary extends Component<{ readonly children: ReactNode }, { message: string | undefined }> {
  override state = { message: undefined };
  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }
  override render() {
    return this.state.message ?? this.props.children;
  }
}

describe("context", () => {
  it("keeps a dialog form apart from the form around it", async () => {
    render(<Page />);
    expect(screen.getByTestId("ids").textContent).toBe("note outer note");
    await userEvent.setup().type(input("Note"), "hi");
    expect(input("Note").id).toBe("note--text");
    expect(input("Note").value).toBe("hi");
  });

  it("throws a clear error with no form.Form above", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Boundary>
        <SubmitButton />
      </Boundary>,
    );
    expect(screen.getByText(/no form\.Form is mounted above this component/)).toBeTruthy();
    render(
      <Boundary>
        <NoteBody />
      </Boundary>,
    );
    expect(screen.getAllByText(/no form\.Form is mounted above this component/)).toHaveLength(2);
    quiet.mockRestore();
  });
});

describe("the form object without form.Form", () => {
  it("binds fields, items, refs and submit with no provider", async () => {
    const list = forms.define({
      defaultValues: { title: "", rows: [{ label: "a" }] },
      validate: { fields: { title: required } },
    });
    const box: { form?: ReturnType<typeof list.useForm> } = {};
    function Bare() {
      const form = list.useForm();
      useEffect(() => {
        box.form = form;
      });
      const ref = useFieldRef(form.root.at("title"));
      return (
        <>
          <div aria-label="title box" ref={ref} tabIndex={-1} />
          <form.Field name="title">{(field) => <p data-testid="title">{field.value || "empty"}</p>}</form.Field>
          <form.Items name="rows">{(row) => <form.TextField handle={row.at("label")} label="Row" />}</form.Items>
          <button type="button" onClick={() => void form.handleSubmit()}>
            submit
          </button>
        </>
      );
    }
    render(<Bare />);
    expect(input("Row").value).toBe("a");
    fireEvent.change(input("Row"), { target: { value: "b" } });
    expect(input("Row").value).toBe("b");
    act(() => box.form?.root.at("title").setValue("T"));
    expect(screen.getByTestId("title").textContent).toBe("T");
    act(() => box.form?.root.at("title").setValue(""));
    fireEvent.click(screen.getByText("submit"));
    await act(settle);
    expect(document.activeElement).toBe(screen.getByLabelText("title box"));
    expect(box.form?.formProps.id).toBe(box.form?.id);
  });
});

describe("one field on two elements", () => {
  const titled = forms.define({ defaultValues: { title: "" }, validate: { fields: { title: required } } });
  type TitledForm = ReturnType<typeof titled.useForm>;
  const box: { form?: TitledForm; ref?: FieldRef } = {};
  const form = (): TitledForm => {
    if (box.form === undefined) throw new Error("no form rendered");
    return box.form;
  };

  function Twice(props: { readonly first: boolean }) {
    const titledForm = titled.useForm();
    const ref = useFieldRef(titledForm.root.at("title"));
    useEffect(() => {
      box.form = titledForm;
      box.ref = ref;
    });
    return (
      <>
        {props.first ? <div aria-label="first" ref={ref} tabIndex={-1} /> : null}
        <div aria-label="second" ref={ref} tabIndex={-1} />
      </>
    );
  }

  it("focuses the element still mounted after the other unmounts", async () => {
    const { rerender } = render(<Twice first />);
    rerender(<Twice first={false} />);
    await act(() => form().handleSubmit());
    expect(document.activeElement).toBe(screen.getByLabelText("second"));
  });

  // Hands out the field's ref callback and renders no element of its own.
  function RefOnly() {
    const titledForm = titled.useForm();
    const ref = useFieldRef(titledForm.root.at("title"));
    useEffect(() => {
      box.form = titledForm;
      box.ref = ref;
    });
    return null;
  }

  it("keeps the element still mounted when React 18 calls the ref with null", async () => {
    render(<RefOnly />);
    const ref = box.ref;
    if (ref === undefined) throw new Error("no ref recorded");
    const a = document.createElement("div");
    const b = document.createElement("div");
    b.tabIndex = -1;
    document.body.append(a, b);
    // React 18 calls the ref with each element as it mounts, then with null
    // when one unmounts, and never calls the returned cleanup.
    ref(a);
    ref(b);
    a.remove();
    ref(null);
    await act(() => form().handleSubmit());
    expect(document.activeElement).toBe(b);
    b.remove();
  });
});
