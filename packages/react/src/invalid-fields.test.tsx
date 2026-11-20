import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { createForms, type FieldApi, type FormOf, inputProps, useForm, useInvalidFields } from "./index.js";

function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field)} />
    </label>
  );
}

const forms = createForms({ fields: { TextField } });
const account = forms.define({ defaultValues: { name: "", email: "" } });

const holder: { form?: FormOf<typeof account>; renders: number } = { renders: 0 };

function Summary(props: { readonly form: FormOf<typeof account> }) {
  const invalid = useInvalidFields(props.form);
  // Runs once per commit, so it counts the renders React kept.
  useEffect(() => {
    holder.renders++;
  });
  return (
    <ul aria-label="summary">
      {invalid.map((entry) => (
        <li key={entry.name}>{`${entry.name}: ${entry.errors[0]?.message ?? ""}`}</li>
      ))}
    </ul>
  );
}

function Account() {
  const form = useForm(account);
  useEffect(() => {
    holder.form = form;
  });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <Summary form={form} />
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
        </form>
      )}
    </form.Form>
  );
}

const items = () => screen.getByRole("list", { name: "summary" }).querySelectorAll("li");
const texts = () => [...items()].map((item) => item.textContent);

describe("useInvalidFields", () => {
  it("lists errors from setErrors, drops a fixed field, and skips renders when nothing in the list changed", () => {
    render(<Account />);
    const store = holder.form?.store;
    if (!store) throw new Error("The form was not rendered.");
    expect(texts()).toEqual([]);
    act(() => store.setErrors({ fields: { email: { message: "Taken" }, name: { message: "Too short" } } }));
    expect(texts()).toEqual(["name: Too short", "email: Taken"]);
    const renders = holder.renders;
    // Touching a field changes its snapshot but not the list.
    act(() => store.root.at("name").setTouched());
    expect(holder.renders).toBe(renders);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    expect(texts()).toEqual(["name: Too short"]);
  });
});
