import type { PluginContext } from "@lunarhue/forms-core";
import { baselineOnSubmit, definePlugin, dirty, history, type Rebase, rebase } from "./plugins.js";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createForms, type FieldApi, type FormOf, useForm, useFormState } from "./index.js";

// Shared: stores each written string's length as the field's meta.
const chars = definePlugin({
  name: "chars",
  setup: (ctx: PluginContext<number>) => ({
    onWrite(records) {
      for (const record of records) if (record.type === "value") ctx.setMeta(record.path, String(record.after).length);
    },
  }),
});

// The definition's own: upper-cases every value and counts the writes on the form.
const upper = definePlugin({
  name: "writes",
  setup(ctx: PluginContext<never, number>) {
    let writes = 0;
    return {
      beforeWrite: (write) => (typeof write.value === "string" ? write.value.toUpperCase() : write.value),
      onWrite: () => ctx.setFormMeta(++writes),
      api: { count: () => writes },
    };
  },
});

function TextField(props: { readonly field: FieldApi<string> }) {
  const { field } = props;
  return (
    <>
      <input aria-label="name" {...field.inputProps()} />
      <output>{chars.meta(field) ?? "none"}</output>
    </>
  );
}

const forms = createForms({ plugins: [chars], fields: { TextField } });
const profile = forms.define({ defaultValues: { name: "" }, plugins: [upper] });

function Profile() {
  const form = useForm(profile);
  const writes = useFormState(form, (snapshot) => upper.formMeta(snapshot) ?? 0);
  return (
    <>
      <form.TextField name="name" />
      <p>{writes}</p>
      <button type="button" onClick={() => form.plugins.writes.count()}>
        count
      </button>
    </>
  );
}

describe("plugins", () => {
  it("run when installed through createForms and define, and their meta reaches the field object and form state", () => {
    expectTypeOf<FormOf<typeof profile>["plugins"]>().toEqualTypeOf<{ readonly writes: { count: () => number } }>();
    const { container } = render(<Profile />);
    const output = container.querySelector("output");
    const writes = container.querySelector("p");
    expect(output?.textContent).toBe("none");
    expect(writes?.textContent).toBe("0");

    fireEvent.change(screen.getByLabelText("name"), { target: { value: "ada" } });
    expect(screen.getByLabelText<HTMLInputElement>("name").value).toBe("ADA");
    expect(output?.textContent).toBe("3");
    expect(writes?.textContent).toBe("1");
  });
});

const order = createForms({ plugins: [rebase()] }).define({ defaultValues: { name: "a", qty: 1 } });

interface OrderPageProps {
  readonly fresh: { readonly name: string; readonly qty: number };
}

function OrderPage({ fresh }: OrderPageProps) {
  const form = useForm(order);
  return (
    <>
      <form.Field name="name">{(field) => <output>{field.value}</output>}</form.Field>
      <form.Field name="qty">{(field) => <p>{String(field.value)}</p>}</form.Field>
      <button type="button" onClick={() => form.plugins.rebase(form.root, fresh, (leaf) => (leaf.edited ? "keep" : "take"))}>
        reload
      </button>
    </>
  );
}

describe("the rebase plugin", () => {
  it("rebases the form through form.plugins.rebase", () => {
    expectTypeOf<FormOf<typeof order>["plugins"]>().toEqualTypeOf<{ readonly rebase: Rebase }>();
    const { container } = render(<OrderPage fresh={{ name: "b", qty: 2 }} />);
    fireEvent.click(screen.getByText("reload"));
    expect(container.querySelector("output")?.textContent).toBe("b");
    expect(container.querySelector("p")?.textContent).toBe("2");
  });
});

const undoHistory = history();
const note = createForms({ plugins: [undoHistory] }).define({ defaultValues: { text: "" } });
// Counts renders of the page, so the test can tell only form.State re-rendered.
const noteRendered = vi.fn<() => void>();

function NotePage() {
  const form = useForm(note);
  noteRendered();
  return (
    <>
      <form.Field name="text">{(field) => <input aria-label="text" {...field.inputProps()} />}</form.Field>
      <form.State select={(snapshot) => undoHistory.formMeta(snapshot).canUndo}>
        {(canUndo) => (
          <button type="button" disabled={!canUndo} onClick={() => form.plugins.history.undo()}>
            Undo
          </button>
        )}
      </form.State>
    </>
  );
}

describe("the history plugin", () => {
  it("enables an undo button through its form meta and disables it after the undo", async () => {
    render(<NotePage />);
    const renders = noteRendered.mock.calls.length;
    const button = screen.getByText<HTMLButtonElement>("Undo");
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("text"), { target: { value: "a" } });
    // The step is recorded a microtask after the write.
    await act(async () => {});
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    expect(screen.getByLabelText<HTMLInputElement>("text").value).toBe("");
    expect(button.disabled).toBe(true);
    // Only form.State re-rendered the button.
    expect(noteRendered).toHaveBeenCalledTimes(renders);
  });
});

const settings = createForms({ plugins: [dirty()] }).define({
  defaultValues: { name: "" },
  plugins: [baselineOnSubmit()],
  onSubmit: async () => "saved",
});

function SettingsPage() {
  const form = useForm(settings);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="name">{(field) => <input aria-label="name" {...field.inputProps()} />}</form.Field>
          <form.State select={(snapshot) => snapshot.dirty}>
            {(changed) => (
              <button type="submit" disabled={!changed}>
                Save
              </button>
            )}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}

describe("the baselineOnSubmit plugin", () => {
  it("disables the save button again after a successful save", async () => {
    render(<SettingsPage />);
    const button = screen.getByText<HTMLButtonElement>("Save");
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Ada" } });
    expect(button.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(screen.getByLabelText<HTMLInputElement>("name").value).toBe("Ada");
    expect(button.disabled).toBe(true);
  });
});
