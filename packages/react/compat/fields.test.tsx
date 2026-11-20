import { fireEvent } from "@testing-library/dom";
import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { Items, createForms, type FieldApi, type FormOf, inputProps, type LeafHandle, useField, useForm, checkboxProps, numberProps } from "../src/index.js";
import { arrays } from "../src/plugins.js";
import { type Commits, countListeners, type Listeners, useCommits } from "../src/test/helpers.js";
import { act, render } from "./render.js";

const commits: Commits = new Map();
beforeEach(() => commits.clear());

function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  useCommits(commits, props.label);
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field)} />
    </label>
  );
}

interface Values {
  name: string;
  email: string;
  age: number | undefined;
  agree: boolean;
  tags: { title: string }[];
}
const defaultValues: Values = { name: "", email: "", age: 30, agree: false, tags: [{ title: "a" }, { title: "b" }] };
const forms = createForms({ plugins: [arrays()], fields: { TextField } });
const profile = forms.define({ defaultValues });
type ProfileForm = FormOf<typeof profile>;

const holder: { form?: ProfileForm; live?: Listeners } = {};
const current = (): ProfileForm => {
  if (holder.form === undefined) throw new Error("no form rendered");
  return holder.form;
};

function Age(props: { readonly field: LeafHandle<number | undefined> }) {
  useCommits(commits, "Age");
  return <input aria-label="Age" {...numberProps(useField(props.field))} />;
}

function Agree(props: { readonly field: LeafHandle<boolean> }) {
  useCommits(commits, "Agree");
  return <input aria-label="Agree" {...checkboxProps(useField(props.field))} />;
}

function NameFilled(props: { readonly field: LeafHandle<string> }) {
  useCommits(commits, "filled");
  const filled = useField(props.field, (snapshot) => snapshot.value !== "");
  return <p data-testid="filled">{filled ? "filled" : "empty"}</p>;
}

function Profile() {
  const form = useForm(profile);
  const [live] = useState(() => countListeners(form.store));
  useEffect(() => {
    holder.form = form;
    holder.live = live;
  });
  return (
    <>
      <form.TextField name="name" label="Name" />
      <form.TextField name="email" label="Email" />
      <NameFilled field={form.root.at("name")} />
      <Age field={form.root.at("age")} />
      <Agree field={form.root.at("agree")} />
      <Items handle={form.root.at("tags")}>{(tag, index) => <form.TextField handle={tag.at("title")} label={`Tag ${index}`} />}</Items>
    </>
  );
}

const input = (container: HTMLElement, label: string): HTMLInputElement => {
  const found = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`) ?? labelled(container, label);
  if (found === null) throw new Error(`no input labelled ${label}`);
  return found;
};

const labelled = (container: HTMLElement, label: string): HTMLInputElement | null => {
  for (const element of container.querySelectorAll("label")) {
    if (element.textContent === label) return element.querySelector("input");
  }
  return null;
};

describe("re-renders", () => {
  it("re-renders a field on its own change and not on another field's", async () => {
    const { container } = await render(<Profile />);
    commits.clear();
    await act(() => fireEvent.change(input(container, "Email"), { target: { value: "ada@example.com" } }));
    expect(input(container, "Email").value).toBe("ada@example.com");
    expect(Object.fromEntries(commits)).toEqual({ Email: 1 });
  });

  it("re-renders a selector only when the selected value changes", async () => {
    const { container } = await render(<Profile />);
    commits.clear();
    await act(() => fireEvent.change(input(container, "Name"), { target: { value: "A" } }));
    expect(container.querySelector("[data-testid=filled]")?.textContent).toBe("filled");
    expect(commits.get("filled")).toBe(1);
    commits.clear();
    await act(() => fireEvent.change(input(container, "Name"), { target: { value: "Ad" } }));
    await act(() => current().root.at("email").setValue("x"));
    expect(commits.has("filled")).toBe(false);
  });
});

describe("inputs", () => {
  it("binds text, number and checkbox inputs", async () => {
    const { container } = await render(<Profile />);
    const root = current().root;

    await act(() => fireEvent.change(input(container, "Name"), { target: { value: "Ada" } }));
    expect(root.at("name").peek().value).toBe("Ada");
    await act(() => root.at("name").setValue("Grace"));
    expect(input(container, "Name").value).toBe("Grace");

    expect(input(container, "Age").value).toBe("30");
    await act(() => fireEvent.change(input(container, "Age"), { target: { value: "41" } }));
    expect(root.at("age").peek().value).toBe(41);
    await act(() => fireEvent.change(input(container, "Age"), { target: { value: "" } }));
    expect(root.at("age").peek().value).toBeUndefined();
    expect(input(container, "Age").value).toBe("");

    expect(input(container, "Agree").checked).toBe(false);
    await act(() => fireEvent.click(input(container, "Agree")));
    expect(root.at("agree").peek().value).toBe(true);
    expect(input(container, "Agree").checked).toBe(true);
    await act(() => root.at("agree").setValue(false));
    expect(input(container, "Agree").checked).toBe(false);
  });
});

describe("array items", () => {
  it("pushes and removes items, and keeps each item's element by key", async () => {
    const { container } = await render(<Profile />);
    const tags = current().root.at("tags");
    const second = input(container, "Tag 1");
    await act(() => fireEvent.change(second, { target: { value: "b2" } }));

    await act(() => tags.remove(0));
    expect(input(container, "Tag 0")).toBe(second);
    expect(second.value).toBe("b2");
    expect(container.querySelectorAll("input").length).toBe(5);

    await act(() => tags.push({ title: "c" }));
    expect(input(container, "Tag 0")).toBe(second);
    expect(input(container, "Tag 1").value).toBe("c");
    expect(tags.peek().value).toEqual([{ title: "b2" }, { title: "c" }]);
  });
});

// A bound component and a `Field`, each with an inline validate prop, under a switch that unmounts both.
const contact = forms.define({ defaultValues: { email: "", phone: "" } });
const contactHolder: { form?: FormOf<typeof contact> } = {};
const emailIs = (value: string) => (value.endsWith("@x.io") ? undefined : { message: "work email" });

function Contact() {
  const form = useForm(contact);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    contactHolder.form = form;
  });
  return (
    <>
      <button type="button" onClick={() => setShown(!shown)}>
        toggle
      </button>
      {shown && (
        <>
          <form.TextField name="email" label="Email" validate={(value) => emailIs(value)} />
          <form.Field name="phone" validate={(value) => (value === "" ? { message: "phone" } : undefined)}>
            {(field) => <p data-testid="phone">{field.errors.map((error) => error.message).join(",")}</p>}
          </form.Field>
        </>
      )}
    </>
  );
}

describe("the validate prop", () => {
  it("adds its errors while mounted and removes them on unmount", async () => {
    const { container } = await render(<Contact />);
    const root = contactHolder.form?.root;
    if (root === undefined) throw new Error("no form rendered");
    await act(() => root.validate());
    expect(root.at("email").peek().errors.map((error) => error.message)).toEqual(["work email"]);
    expect(container.querySelector("[data-testid=phone]")?.textContent).toBe("phone");
    await act(() => fireEvent.change(input(container, "Email"), { target: { value: "ada@x.io" } }));
    expect(root.at("email").peek().errors).toEqual([]);
    await act(() => root.at("email").setValue("ada@y.io"));
    expect(root.at("email").peek().errors.map((error) => error.message)).toEqual(["work email"]);
    const toggle = container.querySelector("button");
    await act(() => toggle?.click());
    expect(root.at("email").peek().errors).toEqual([]);
    expect(root.at("phone").peek().errors).toEqual([]);
  });
});

describe("unmount", () => {
  it("removes every subscription", async () => {
    const { unmount } = await render(<Profile />);
    const live = holder.live;
    expect(live?.fields).toBeGreaterThan(0);
    expect(live?.form).toBe(0);
    await unmount();
    expect(live).toEqual({ fields: 0, form: 0 });
  });
});
