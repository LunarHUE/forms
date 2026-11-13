import { fireEvent } from "@testing-library/dom";
import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { createForms, type FieldApi, type LeafHandle, useField, useInputProps } from "../src/index.js";
import { type Commits, countListeners, type Listeners, useCommits } from "../src/test/helpers.js";
import { act, render } from "./render.js";

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

interface Values {
  name: string;
  email: string;
  age: number | undefined;
  agree: boolean;
  tags: { title: string }[];
}
const defaultValues: Values = { name: "", email: "", age: 30, agree: false, tags: [{ title: "a" }, { title: "b" }] };
const forms = createForms({ fields: { TextField } });
const profile = forms.define({ defaultValues });
type ProfileForm = ReturnType<typeof profile.useForm>;

const holder: { form?: ProfileForm; live?: Listeners } = {};
const current = (): ProfileForm => {
  if (holder.form === undefined) throw new Error("no form rendered");
  return holder.form;
};

function Age(props: { readonly field: LeafHandle<number | undefined> }) {
  useCommits(commits, "Age");
  return <input aria-label="Age" {...useInputProps(props.field, { kind: "number" })} />;
}

function Agree(props: { readonly field: LeafHandle<boolean> }) {
  useCommits(commits, "Agree");
  return <input aria-label="Agree" {...useInputProps(props.field, { kind: "checkbox" })} />;
}

function NameFilled(props: { readonly field: LeafHandle<string> }) {
  useCommits(commits, "filled");
  const filled = useField(props.field, (snapshot) => snapshot.value !== "");
  return <p data-testid="filled">{filled ? "filled" : "empty"}</p>;
}

function Profile() {
  const form = profile.useForm();
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
      <form.Items name="tags">{(tag, index) => <form.TextField handle={tag.at("title")} label={`Tag ${index}`} />}</form.Items>
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
