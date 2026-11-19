import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { StandardSchemaV1 } from "@lunarhue/forms-core";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createForms, type FieldApi, type FormOf, inputProps, useForm, useFormContext, useFormState } from "./index.js";
import { type Commits, settle, useCommits } from "./test/helpers.js";
import { defineSchemaPlugin } from "./plugins.js";

// Fast Refresh runs an edited module again and keeps the state of its mounted
// components. These tests do the same: `load` stands for the module body, and
// assigning `signUp` stands for the reload. The page is never remounted.

interface Value {
  readonly name: string;
}

/** A schema that fails while the name is shorter than `min`. */
const minLength = (min: number): StandardSchemaV1<Value> => ({
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => {
      // The form only ever passes its own value.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const { name } = value as Value;
      return name.length < min ? { issues: [{ message: `at least ${min}`, path: ["name"] }] } : { value: { name } };
    },
  },
});

/** The schema plugin for `minLength`'s schemas. Every form gives its defaultValues. */
const testSchemas = defineSchemaPlugin<StandardSchemaV1<Value>>({
  vendor: "test",
  defaultValue: () => ({ name: "" }),
  itemValue: () => undefined,
});

/** The module body: its own field component, `createForms` and `define`. */
function load(version: string, min: number, onSubmit: (value: Value) => void) {
  function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
    return (
      <label>
        {`${props.label} ${version}`}
        <input {...inputProps(props.field)} />
      </label>
    );
  }
  const forms = createForms({ plugins: [testSchemas], fields: { TextField } });
  return forms.define({ schema: minLength(min), defaultValues: { name: "" }, onSubmit });
}

const first = vi.fn<(value: Value) => void>();
const second = vi.fn<(value: Value) => void>();
let signUp = load("v1", 1, first);

const commits: Commits = new Map();
const seen: { page?: FormOf<typeof signUp>; child?: FormOf<typeof signUp>; id?: string } = {};

beforeEach(() => {
  signUp = load("v1", 1, first);
  first.mockClear();
  second.mockClear();
  commits.clear();
});

function Status() {
  const form = useFormContext(signUp);
  const status = useFormState(form, (snapshot) => snapshot.submission.status);
  useEffect(() => {
    seen.child = form;
  });
  return <p data-testid="status">{status}</p>;
}

function Page(props: { readonly render: number }) {
  const form = useForm(signUp);
  useCommits(commits, "page");
  useEffect(() => {
    seen.page = form;
    seen.id = form.id;
  });
  return (
    <form.Form>
      {(formProps) => (
        <form aria-label="sign up" data-render={props.render} {...formProps}>
          <form.TextField name="name" label="Name" />
          <Status />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}

describe("hot reload", () => {
  it("keeps the same form and adds no commits while the definition stays the same", () => {
    const { rerender } = render(<Page render={1} />);
    const form = seen.page;
    commits.clear();
    rerender(<Page render={2} />);
    rerender(<Page render={3} />);
    expect(seen.page).toBe(form);
    expect(seen.child).toBe(form);
    expect(Object.fromEntries(commits)).toEqual({ page: 2 });
  });

  it("makes a form from a new definition and keeps the generated id", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Page render={1} />);
    const old = seen.page;
    const id = seen.id;
    expect(screen.getByText("Name v1")).toBeDefined();

    signUp = load("v2", 3, second);
    commits.clear();
    rerender(<Page render={2} />);
    expect(Object.fromEntries(commits)).toEqual({ page: 1 });
    expect(seen.page).not.toBe(old);
    expect(seen.child).toBe(seen.page);
    expect(seen.id).toBe(id);
    expect(screen.getByText("Name v2")).toBeDefined();

    // "ab" passes the old schema and fails the new one.
    await user.type(screen.getByRole("textbox"), "ab");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(settle);
    expect(screen.getByTestId("status").textContent).toBe("invalid");

    await user.type(screen.getByRole("textbox"), "c");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await act(settle);
    expect(second.mock.calls.map(([value]) => value)).toEqual([{ name: "abc" }]);
    expect(first).not.toHaveBeenCalled();
  });

  it("stops re-rendering for writes to the old form's store", () => {
    const { rerender } = render(<Page render={1} />);
    const old = seen.page;
    signUp = load("v2", 3, second);
    rerender(<Page render={2} />);
    commits.clear();
    act(() => old?.root.at("name").setValue("stale"));
    expect(Object.fromEntries(commits)).toEqual({});
    expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("");
  });
});

// A shared part reads the form by its `createForms` result, which a reload of the page module keeps.
const shared = createForms({ plugins: [testSchemas] });
const remake = (min: number) => shared.define({ schema: minLength(min), defaultValues: { name: "" } });
let draft = remake(1);
const reads: unknown[] = [];

function SharedReader() {
  const form = useFormContext(shared);
  useEffect(() => {
    reads.push(form);
  });
  return null;
}

function DraftPage(props: { readonly render: number }) {
  const form = useForm(draft);
  useEffect(() => {
    reads.push(form);
  });
  return (
    <form.Form>
      <p data-render={props.render} />
      <SharedReader />
    </form.Form>
  );
}

describe("hot reload under the same forms", () => {
  it("finds the form made from the remade definition", () => {
    const { rerender } = render(<DraftPage render={1} />);
    const [, old] = reads;
    expect(old).toBeDefined();
    draft = remake(3);
    reads.length = 0;
    rerender(<DraftPage render={2} />);
    const [child, page] = reads;
    expect(page).not.toBe(old);
    expect(child).toBe(page);
  });
});
