// One contract, run against the full entry and /mini. A form written for
// /mini moves to the full entry by changing its import, so every behaviour
// mini has must match full's. Each case runs on full, full with the
// `perField()` no-op, mini, and mini with `perField()`.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import * as full from "./index.js";
import * as mini from "./mini.js";
import * as fullParts from "./plugins.js";
import { settle } from "./test/helpers.js";

/** The members of an entry the contract uses, typed as mini's. Full's fit them at runtime. */
interface Entry {
  readonly createForms: typeof mini.createForms;
  readonly useForm: typeof mini.useForm;
  readonly inputProps: typeof mini.inputProps;
  readonly fieldValidators: typeof mini.fieldValidators;
  readonly transform: typeof mini.transform;
  readonly text: typeof mini.text;
  readonly observe: typeof mini.observe;
}

// Full's types are wider than mini's, and the contract checks the runtime only.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const fullEntry = { ...full, ...fullParts } as unknown as Entry;
const miniEntry: Entry = mini;

const entries: readonly (readonly [name: string, entry: Entry, options: mini.FormsOptions])[] = [
  ["full", fullEntry, {}],
  ["full + perField()", fullEntry, { subscribe: mini.perField() }],
  ["mini", miniEntry, {}],
  ["mini + perField()", miniEntry, { subscribe: mini.perField() }],
];

interface Search {
  q: string;
  page: string;
}

type SearchForm = mini.FormInstance<Search>;

const required = (value: string) => (value.trim() ? undefined : { message: "Type something." });
const digits = (value: string) => (/^\d+$/.test(value) ? undefined : { message: "A number." });

/** A schema with one cross-field issue: a page past the first needs a query. */
const paged: mini.StandardSchemaV1<Search> = {
  "~standard": {
    version: 1,
    vendor: "contract",
    validate: (value) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const { q, page } = value as Search;
      return q || page === "1" ? { value: { q, page } } : { issues: [{ message: "Pick a query first.", path: ["page"] }] };
    },
  },
};

/** Holds the form the last render made, for commands and reads from the test. */
const holder: { form?: SearchForm } = {};
const current = (): SearchForm => {
  if (holder.form === undefined) throw new Error("no form rendered");
  return holder.form;
};

interface SearchFormProps {
  readonly definition: mini.ReactFormDefinition<Search>;
  readonly id?: string;
}

interface TextInputProps {
  readonly entry: Entry;
  readonly field: mini.FieldApi<string>;
  readonly label: string;
}

function TextInput({ entry, field, label }: TextInputProps) {
  return (
    <>
      <input aria-label={label} {...entry.inputProps(field)} />
      <span role="status" aria-label={`${label} errors`}>
        {field.shownErrors.map((error) => error.message).join(",")}
      </span>
    </>
  );
}

/**
 * Makes a form with two text fields that show their errors, and the submit
 * status, on one entry. One component per entry, so `useForm` is the same
 * function on every render.
 */
function searchFormOn(entry: Entry) {
  const { useForm } = entry;
  return function SearchForm({ definition, id }: SearchFormProps) {
    const form = useForm(definition, id === undefined ? undefined : { id });
    useEffect(() => {
      holder.form = form;
    });
    return (
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.Field name="q">{(field) => <TextInput entry={entry} field={field} label="Query" />}</form.Field>
            <form.Field name="page">{(field) => <TextInput entry={entry} field={field} label="Page" />}</form.Field>
            <form.State select={(snapshot) => snapshot.submission.status}>{(status) => <output aria-label="status">{status}</output>}</form.State>
            <button type="submit">Search</button>
          </form>
        )}
      </form.Form>
    );
  };
}

const components = new Map([fullEntry, miniEntry].map((entry) => [entry, searchFormOn(entry)]));
const componentOf = (entry: Entry): ReturnType<typeof searchFormOn> => {
  const component = components.get(entry);
  if (component === undefined) throw new Error("unknown entry");
  return component;
};

const input = (label: string): HTMLInputElement => {
  const element = screen.getByLabelText(label);
  if (!(element instanceof HTMLInputElement)) throw new Error(`${label} is not an input`);
  return element;
};
const errorsOf = (label: string): string => screen.getByLabelText(`${label} errors`).textContent ?? "";
const statusText = (): string => screen.getByLabelText("status").textContent ?? "";

const handleOf = (name: string): mini.NamedAnyFieldHandle => {
  const { store } = current();
  const handle = store.fieldAt(store.pathOf(name) ?? []);
  if (handle === undefined) throw new Error(`no field ${name}`);
  return handle;
};

function mount(entry: Entry, definition: SearchFormProps["definition"], id?: string): void {
  const SearchForm = componentOf(entry);
  render(id === undefined ? <SearchForm definition={definition} /> : <SearchForm definition={definition} id={id} />);
}

describe.each(entries)("%s", (_name, entry, options) => {
  const forms = entry.createForms(options);
  const plain = (onSubmit?: (value: Search) => unknown) =>
    forms.define({
      defaultValues: { q: "", page: "1" },
      validate: { fields: entry.fieldValidators<Search>({ q: required }) },
      ...(onSubmit ? { onSubmit } : {}),
    });

  it("starts with empty errors and an idle form", () => {
    mount(entry, plain());
    const { store } = current();
    expect(handleOf("q").peek()).toMatchObject({ value: "", name: "q", errors: [], shownErrors: [], invalid: false, touched: false });
    expect(store.getFormSnapshot()).toMatchObject({ submitting: false, submission: { status: "idle" }, submitCount: 0 });
    expect(input("Query").value).toBe("");
    expect(input("Page").value).toBe("1");
  });

  it("keeps snapshot identity until a member changes", () => {
    mount(entry, plain());
    const { store } = current();
    const page = handleOf("page").peek();
    const form = store.getFormSnapshot();
    act(() => handleOf("page").setValue("1"));
    expect(handleOf("page").peek()).toBe(page);
    act(() => handleOf("q").setValue("shoes"));
    expect(handleOf("page").peek()).toBe(page);
    expect(store.getFormSnapshot()).toBe(form);
    expect(handleOf("q").peek().value).toBe("shoes");
  });

  it("shows a validator's error after blur and rechecks it on change", () => {
    mount(entry, plain());
    expect(errorsOf("Query")).toBe("");
    fireEvent.blur(input("Query"));
    expect(errorsOf("Query")).toBe("Type something.");
    expect(handleOf("q").peek().touched).toBe(true);
    fireEvent.change(input("Query"), { target: { value: "shoes" } });
    expect(errorsOf("Query")).toBe("");
    fireEvent.change(input("Query"), { target: { value: " " } });
    expect(errorsOf("Query")).toBe("Type something.");
    expect(current().store.getFormSnapshot().valid).toBe(false);
  });

  it("shows every field's errors after a failed submit", async () => {
    const onSubmit = vi.fn<(value: Search) => void>();
    mount(entry, plain(onSubmit));
    await act(() => current().submit());
    expect(errorsOf("Query")).toBe("Type something.");
    expect(statusText()).toBe("invalid");
    expect(current().store.getFormSnapshot().submitCount).toBe(1);
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(input("Query"), { target: { value: "shoes" } });
    expect(errorsOf("Query")).toBe("");
  });

  it("puts a Standard Schema's issues on the fields they name", async () => {
    const schema: mini.StandardSchemaV1<Search> = {
      "~standard": {
        version: 1,
        vendor: "contract",
        validate: (value) => {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          const { q, page } = value as Search;
          const issues = [
            ...(q ? [] : [{ message: "Required.", path: ["q"] }]),
            ...(/^\d+$/.test(page) ? [] : [{ message: "A number.", path: [{ key: "page" }] }]),
          ];
          return issues.length ? { issues } : { value: { q, page } };
        },
      },
    };
    const onSubmit = vi.fn<(value: Search) => void>();
    mount(entry, forms.define({ schema, defaultValues: { q: "", page: "x" }, onSubmit }));
    await act(() => current().submit());
    expect(errorsOf("Query")).toBe("Required.");
    expect(errorsOf("Page")).toBe("A number.");
    fireEvent.change(input("Query"), { target: { value: "shoes" } });
    fireEvent.change(input("Page"), { target: { value: "2" } });
    expect(errorsOf("Query")).toBe("");
    expect(errorsOf("Page")).toBe("");
    await act(() => current().submit());
    expect(onSubmit).toHaveBeenCalledWith({ q: "shoes", page: "2" }, expect.anything());
  });

  it("rechecks a schema's cross-field issue on a touched field when another field changes", () => {
    mount(entry, forms.define({ schema: paged, defaultValues: { q: "shoes", page: "1" } }));
    const { store } = current();
    fireEvent.blur(input("Query"));
    fireEvent.change(input("Page"), { target: { value: "2" } });
    fireEvent.blur(input("Page"));
    expect(errorsOf("Page")).toBe("");
    fireEvent.change(input("Query"), { target: { value: "" } });
    expect(errorsOf("Page")).toBe("Pick a query first.");
    expect(store.getFormSnapshot().valid).toBe(false);
    fireEvent.change(input("Query"), { target: { value: "hats" } });
    expect(errorsOf("Page")).toBe("");
    expect(handleOf("page").peek()).toMatchObject({ errors: [], invalid: false });
    expect(store.getFormSnapshot().valid).toBe(true);
  });

  it("keeps other fields' validator errors when the schema runs for one field", async () => {
    mount(entry, forms.define({ schema: paged, defaultValues: { q: "", page: "1" }, validate: { fields: entry.fieldValidators<Search>({ q: required, page: digits }) } }));
    const { store } = current();
    fireEvent.blur(input("Query"));
    fireEvent.blur(input("Page"));
    expect(errorsOf("Query")).toBe("Type something.");
    fireEvent.change(input("Page"), { target: { value: "2" } });
    expect(errorsOf("Page")).toBe("Pick a query first.");
    expect(errorsOf("Query")).toBe("Type something.");
    fireEvent.change(input("Query"), { target: { value: "shoes" } });
    expect(errorsOf("Query")).toBe("");
    expect(errorsOf("Page")).toBe("");
    expect(store.getFormSnapshot().valid).toBe(true);
    act(() => store.reset());
    await act(() => current().submit());
    fireEvent.change(input("Page"), { target: { value: "3" } });
    expect(errorsOf("Query")).toBe("Type something.");
    expect(handleOf("q").peek()).toMatchObject({ errors: [{ message: "Type something." }], invalid: true });
    expect(errorsOf("Page")).toBe("Pick a query first.");
    // The schema's issues come before a field validator's errors.
    fireEvent.change(input("Page"), { target: { value: "x" } });
    expect(errorsOf("Page")).toBe("Pick a query first.,A number.");
  });

  it("runs one submit at a time and ends succeeded or failed", async () => {
    const pending: ((result: string) => void)[] = [];
    const onSubmit = vi.fn<(value: Search) => Promise<string>>(() => new Promise<string>((resolve) => pending.push(resolve)));
    mount(entry, plain(onSubmit));
    fireEvent.change(input("Query"), { target: { value: "shoes" } });
    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = current().submit();
      second = current().submit();
    });
    // Full validates before it calls onSubmit, a tick later.
    await act(settle);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ q: "shoes", page: "1" }, expect.anything());
    expect(statusText()).toBe("submitting");
    expect(current().store.getFormSnapshot().submitting).toBe(true);
    await act(async () => {
      pending[0]?.("done");
      await first;
    });
    expect(statusText()).toBe("succeeded");
    // Full hands the second caller its own promise of the same submission.
    expect(await second).toEqual(await first);
    expect(current().store.getFormSnapshot().submission).toEqual({ status: "succeeded", result: "done" });

    onSubmit.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    await act(() => current().submit());
    expect(statusText()).toBe("failed");
    expect(current().store.getFormSnapshot().submitCount).toBe(2);
  });

  it("submits from the form element", async () => {
    const onSubmit = vi.fn<(value: Search) => void>();
    mount(entry, plain(onSubmit));
    fireEvent.change(input("Query"), { target: { value: "shoes" } });
    fireEvent.submit(screen.getByRole("button").closest("form") ?? document.body);
    await act(settle);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows setErrors at once and clears a field's on its next edit", () => {
    mount(entry, plain());
    act(() => current().store.setErrors({ fields: { q: { message: "Taken." }, page: { message: "Too far." } } }));
    expect(errorsOf("Query")).toBe("Taken.");
    expect(errorsOf("Page")).toBe("Too far.");
    fireEvent.change(input("Query"), { target: { value: "boots" } });
    expect(errorsOf("Query")).toBe("");
    expect(errorsOf("Page")).toBe("Too far.");
  });

  it("names ids after the form and resets everything but the submit count", async () => {
    mount(entry, plain(), "search");
    expect(current().id).toBe("search");
    expect(input("Query").id).toBe("search--q");
    expect(handleOf("q").id).toBe("search--q");
    fireEvent.change(input("Query"), { target: { value: "x" } });
    fireEvent.blur(input("Query"));
    await act(() => current().submit());
    act(() => current().store.reset());
    expect(input("Query").value).toBe("");
    expect(errorsOf("Query")).toBe("");
    expect(handleOf("q").peek()).toMatchObject({ touched: false, errors: [] });
    // The count is of every submit the store ran, so a reset keeps it.
    expect(current().store.getFormSnapshot()).toMatchObject({ submission: { status: "idle" }, submitCount: 1 });
    fireEvent.blur(input("Query"));
    expect(errorsOf("Query")).toBe("Type something.");
    expect(input("Query").getAttribute("aria-describedby")).toBe("search--q---error");
  });

  it("gives every form its own generated id", () => {
    const SearchForm = componentOf(entry);
    render(
      <>
        <SearchForm definition={plain()} />
        <SearchForm definition={plain()} />
      </>,
    );
    const [one, two] = screen.getAllByLabelText("Query");
    expect(one?.id).toMatch(/--q$/);
    expect(one?.id).not.toBe(two?.id);
  });

  it("runs the portable parts where they are pinned", () => {
    const seen: string[] = [];
    const Query = forms.fieldset<string>(
      entry.transform((value) => value.trimStart()),
      entry.text((value) => value.toUpperCase()),
      entry.observe((value) => {
        seen.push(value);
      }),
    );
    mount(entry, forms.define({ defaultValues: { q: "  hats", page: "1" } }, Query.at("q")));
    expect(handleOf("q").peek().value).toBe("hats");
    expect(input("Query").value).toBe("HATS");
    fireEvent.change(input("Query"), { target: { value: "  caps" } });
    expect(handleOf("q").peek().value).toBe("caps");
    expect(input("Query").value).toBe("CAPS");
    expect(seen[seen.length - 1]).toBe("caps");
    act(() => handleOf("page").setValue("2"));
    expect(seen.filter((value) => value === "caps")).toHaveLength(1);
  });

  it("refuses a write when a transform returns refuse", () => {
    const digitsOnly = forms.fieldset<string>(entry.transform((value) => (/^\d*$/.test(value) ? value : mini.refuse)));
    mount(entry, forms.define({ defaultValues: { q: "", page: "1" } }, digitsOnly.at("page")));
    fireEvent.change(input("Page"), { target: { value: "2x" } });
    expect(handleOf("page").peek().value).toBe("1");
    fireEvent.change(input("Page"), { target: { value: "22" } });
    expect(handleOf("page").peek().value).toBe("22");
  });
});

interface TextFieldProps {
  readonly field: mini.FieldApi<string>;
  readonly label: string;
  readonly hint?: string;
}

/** A registered field component, bound by hand so it needs neither entry's `inputProps`. */
function TextField(props: TextFieldProps) {
  const { field, label, hint } = props;
  received.push(props);
  return (
    <>
      <input aria-label={label} id={field.id} value={field.text} onChange={(event) => field.setText(event.target.value, event)} onBlur={field.handleBlur} />
      <span role="status" aria-label={`${label} errors`}>
        {field.shownErrors.map((error) => error.message).join(",")}
      </span>
      {hint === undefined ? null : <small>{hint}</small>}
    </>
  );
}

/** The props each `TextField` render got, in order. */
const received: TextFieldProps[] = [];

describe.each(entries)("%s: registered field components", (_name, entry, options) => {
  const forms = entry.createForms({ ...options, fields: { TextField } });
  const definition = forms.define({
    defaultValues: { q: "", page: "1" },
    validate: { fields: entry.fieldValidators<Search>({ q: required }) },
  });
  type Registered = mini.FormOf<typeof definition>;
  const seen: { form?: Registered } = {};

  function RegisteredForm() {
    const form = entry.useForm(definition);
    useEffect(() => {
      seen.form = form;
    });
    return (
      <form {...form.formProps}>
        <form.TextField name="q" label="Query" hint="Brand or model" />
        <form.TextField name="page" label="Page" />
      </form>
    );
  }

  it("renders the component with its own props and the named field", () => {
    received.length = 0;
    render(<RegisteredForm />);
    expect(input("Query").value).toBe("");
    expect(input("Page").value).toBe("1");
    expect(screen.getByText("Brand or model")).toBeDefined();
    expect(received[0]?.label).toBe("Query");
    expect(received[0]?.field.name).toBe("q");
    // `name` is the bound component's own and never reaches the registered one.
    expect(received.every((props) => !("name" in props))).toBe(true);
    fireEvent.change(input("Page"), { target: { value: "2" } });
    const store = seen.form?.store;
    expect(store?.fieldAt(store.pathOf("page") ?? [])?.peek().value).toBe("2");
    expect(input("Page").value).toBe("2");
  });

  it("shows the field's errors after blur", () => {
    render(<RegisteredForm />);
    fireEvent.blur(input("Query"));
    expect(errorsOf("Query")).toBe("Type something.");
    fireEvent.change(input("Query"), { target: { value: "shoes" } });
    expect(errorsOf("Query")).toBe("");
  });

  it("keeps each bound component's identity for the life of the form", () => {
    render(<RegisteredForm />);
    const first = seen.form?.TextField;
    fireEvent.change(input("Query"), { target: { value: "shoes" } });
    expect(seen.form?.TextField).toBe(first);
  });

  it("keeps the form's own members over a registered component of the same name", async () => {
    const clashing = entry
      .createForms({
        ...options,
        // @ts-expect-error: submit is the form's own
        fields: { submit: TextField },
      })
      .define({ defaultValues: { q: "", page: "1" } });
    function Clashing() {
      const form = entry.useForm(clashing);
      useEffect(() => {
        holder.form = form;
      });
      return null;
    }
    render(<Clashing />);
    // A bound component would call hooks outside a render and throw.
    await act(() => current().submit());
    expect(current().store.getFormSnapshot().submitCount).toBe(1);
  });
});

describe("perField()", () => {
  // The full entry always wakes per field. Mini wakes every listener on each change unless the form opts in.
  it.each([
    ["full", 0, fullEntry, {}],
    ["mini", 1, miniEntry, {}],
    ["mini + perField()", 0, miniEntry, { subscribe: mini.perField() }],
  ] as const)("%s: a write that leaves the form snapshot alone wakes the form listener %i times", (_name, wakes, entry, options: mini.FormsOptions) => {
    const definition = entry.createForms(options).define({ defaultValues: { q: "", page: "1" } });
    mount(entry, definition);
    const listener = vi.fn<() => void>();
    const stop = current().store.subscribeForm(listener);
    act(() => handleOf("q").setValue("shoes"));
    stop();
    expect(listener).toHaveBeenCalledTimes(wakes);
  });
});
