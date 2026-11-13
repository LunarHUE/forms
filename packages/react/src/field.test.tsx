import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createForms,
  type FieldApi,
  type FormOf,
  type LeafHandle,
  useField,
  useForm,
  useFormState,
  useInputProps,
  useItems,
  useValidator,
  type ValidatorInput,
} from "./index.js";
import { type Commits, countListeners, type Listeners, settle, useCommits } from "./test/helpers.js";
import { dirty as dirtyPlugin } from "./plugins/dirty.js";
import { validation } from "./plugins/validation.js";

const commits: Commits = new Map();
beforeEach(() => commits.clear());

function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  useCommits(commits, props.label);
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps()} />
    </label>
  );
}

const forms = createForms({ fields: { TextField } });
const order = forms.define({
  defaultValues: { customer: "", email: "", lines: [{ item: "pen" }, { item: "ink" }] },
});

function Line(props: { readonly item: LeafHandle<string>; readonly name: string }) {
  useCommits(commits, props.name);
  return <input aria-label={props.name} {...useInputProps(props.item)} />;
}

function Lines(props: { readonly form: FormOf<typeof order> }) {
  const { form } = props;
  return (
    <form.Items name="lines">
      {(line, index) => {
        return (
          <>
            <ItemsProbe />
            <Line item={line.at("item")} name={`line ${index}`} />
          </>
        );
      }}
    </form.Items>
  );
}

// Commits once per render of form.Items' children, since Items renders it fresh each time.
function ItemsProbe() {
  useCommits(commits, "items");
  return null;
}

function OrderPage(props: { readonly onLive?: (live: Listeners) => void }) {
  const form = useForm(order);
  const [live] = useState(() => countListeners(form.store));
  useCommits(commits, "page");
  const { onLive } = props;
  return (
    <>
      <form.TextField name="customer" label="Customer" />
      <form.TextField name="email" label="Email" />
      <Lines form={form} />
      <button type="button" onClick={() => onLive?.(live)}>
        live
      </button>
    </>
  );
}

describe("re-render isolation", () => {
  it("typing in one field re-renders only that field", () => {
    render(<OrderPage />);
    commits.clear();
    fireEvent.change(screen.getByLabelText("Customer"), { target: { value: "Ada" } });
    expect(screen.getByLabelText<HTMLInputElement>("Customer").value).toBe("Ada");
    expect(Object.fromEntries(commits)).toEqual({ Customer: 1 });

    commits.clear();
    fireEvent.change(screen.getByLabelText("line 0"), { target: { value: "pencil" } });
    expect(Object.fromEntries(commits)).toEqual({ "line 0": 1 });
  });

  it("a selector that returns the same value causes no re-render", () => {
    const profile = createForms().define({ defaultValues: { name: "", age: 1 } });
    const holder: { form?: FormOf<typeof profile> } = {};
    function Empty() {
      const form = useForm(profile);
      useEffect(() => {
        holder.form = form;
      });
      const empty = useField(form.root.at("name"), (snapshot) => snapshot.value === "");
      const submitting = useFormState(form, (snapshot) => snapshot.submitting);
      useCommits(commits, "empty");
      return <p>{`${empty} ${submitting}`}</p>;
    }
    render(<Empty />);
    const root = holder.form?.root;
    commits.clear();
    act(() => root?.at("name").setValue("a"));
    expect(Object.fromEntries(commits)).toEqual({ empty: 1 });
    expect(screen.getByText("false false")).toBeTruthy();
    commits.clear();
    act(() => root?.at("name").setValue("ab"));
    act(() => root?.at("age").setValue(2));
    act(() => root?.at("name").handleBlur());
    expect(Object.fromEntries(commits)).toEqual({});
  });
});

describe("useItems", () => {
  it("keeps its list while the keys stay, and follows push", () => {
    const list = createForms().define({ defaultValues: { tags: ["a", "b"] } });
    const holder: { form?: FormOf<typeof list> } = {};
    const lists: (readonly unknown[])[] = [];
    function Tags() {
      const form = useForm(list);
      const items = useItems(form.root.at("tags"));
      useEffect(() => {
        holder.form = form;
      });
      useEffect(() => {
        lists.push(items);
      }, [items]);
      useCommits(commits, "tags");
      return <p>{items.map((item) => item.key).join(",")}</p>;
    }
    render(<Tags />);
    const tags = holder.form?.root.at("tags");
    const before = lists.length;
    commits.clear();
    act(() => tags?.item(tags.peek().keys[0] ?? "").setValue("z"));
    expect(commits.get("tags")).toBeUndefined();
    act(() => tags?.push("c"));
    expect(commits.get("tags")).toBe(1);
    expect(lists.length).toBe(before + 1);
    expect(lists[lists.length - 1]).toHaveLength(3);
  });
});

const toError = (message: string | undefined) => (message === undefined ? undefined : { message });
type Check = (value: string) => string | undefined;
const signup = createForms({ plugins: [validation()] }).define({ defaultValues: { name: "" } });

function Name(props: { readonly validator: Check; readonly debounce?: number }) {
  const form = useForm(signup);
  const name = form.root.at("name");
  const input: ValidatorInput<string> =
    props.debounce === undefined ? (value) => toError(props.validator(value)) : { validate: (value) => toError(props.validator(value)), debounce: props.debounce };
  useValidator(name, input);
  const errors = useField(name, (snapshot) => snapshot.errors.map((error) => error.message).join(","));
  return (
    <>
      <input aria-label="name" {...useInputProps(name)} />
      <p role="status">{errors}</p>
      <button type="button" onClick={() => void name.validate()}>
        check
      </button>
    </>
  );
}

describe("useValidator", () => {
  it("registers once for an inline function and calls the latest one", async () => {
    const first = vi.fn<Check>((value) => (value === "" ? "first" : undefined));
    const second = vi.fn<Check>((value) => (value === "" ? "second" : undefined));
    const { rerender } = render(<Name validator={first} />);
    rerender(<Name validator={second} />);
    rerender(<Name validator={second} />);
    await act(async () => {
      fireEvent.click(screen.getByText("check"));
      await settle();
    });
    expect(screen.getByRole("status").textContent).toBe("second");
    expect(first).not.toHaveBeenCalled();
    // One registration: a second registered validator would add a second error.
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("removes the validator, its errors and its timers on unmount", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const check = vi.fn<Check>((value) => (value.length < 3 ? "short" : undefined));
    const { unmount } = render(<Name validator={check} debounce={200} />);
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "a" } });
    fireEvent.blur(screen.getByLabelText("name"));
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "ab" } });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(check).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

function Toggle() {
  const [shown, setShown] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setShown(!shown)}>
        toggle
      </button>
      {shown && <OrderPage />}
    </>
  );
}

describe("StrictMode lifecycle", () => {
  it("leaves no listeners after unmount", () => {
    let live: Listeners | undefined;
    const { unmount } = render(
      <OrderPage
        onLive={(counts) => {
          live = counts;
        }}
      />,
    );
    fireEvent.click(screen.getByText("live"));
    expect(live?.fields).toBeGreaterThan(0);
    unmount();
    expect(live).toEqual({ fields: 0, form: 0 });
  });

  it("leaves no form listeners after unmount", () => {
    const status = createForms({ plugins: [dirtyPlugin()] }).define({ defaultValues: { name: "" } });
    let live: Listeners | undefined;
    function Status() {
      const form = useForm(status);
      const [counts] = useState(() => countListeners(form.store));
      const dirty = useFormState(form, (snapshot) => snapshot.dirty);
      return (
        <button type="button" onClick={() => (live = counts)}>
          {String(dirty)}
        </button>
      );
    }
    const { unmount } = render(<Status />);
    fireEvent.click(screen.getByText("false"));
    expect(live?.form).toBe(1);
    unmount();
    expect(live?.form).toBe(0);
  });

  it("works after unmount and remount", () => {
    render(<Toggle />);
    fireEvent.change(screen.getByLabelText("Customer"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByText("toggle"));
    expect(screen.queryByLabelText("Customer")).toBeNull();
    fireEvent.click(screen.getByText("toggle"));
    const input = screen.getByLabelText<HTMLInputElement>("Customer");
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "Bo" } });
    expect(input.value).toBe("Bo");
  });
});
