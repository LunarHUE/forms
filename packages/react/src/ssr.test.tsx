import { act } from "@testing-library/react";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createForms, type FieldApi, useFormContext, useFormState, useInputProps } from "./index.js";

function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  return (
    <label htmlFor={props.field.id}>
      {props.label}
      <input {...props.field.inputProps()} />
    </label>
  );
}

interface Order {
  customer: string;
  plan: "free" | "pro";
  lines: { item: string }[];
}
const initial: Order = { customer: "Ada", plan: "free", lines: [{ item: "pen" }, { item: "ink" }] };
const order = createForms({ fields: { TextField } }).define({ defaultValues: initial });

function Plan() {
  const form = order.useFormContext();
  const plan = form.root.at("plan");
  return (
    <>
      <input {...useInputProps(plan, { kind: "radio", value: "free" })} />
      <input {...useInputProps(plan, { kind: "radio", value: "pro" })} />
    </>
  );
}

function Status() {
  const form = useFormContext();
  const dirty = useFormState(form, (snapshot) => snapshot.dirty);
  return <p>{dirty ? "dirty" : "clean"}</p>;
}

function Order() {
  const form = order.useForm();
  return (
    <form.Form>
      {({ submit: _submit, ...props }) => (
        <form {...props}>
          <form.TextField name="customer" label="Customer" />
          <Plan />
          <form.Items name="lines">{(line) => <form.TextField handle={line.at("item")} label="Item" />}</form.Items>
          <Status />
        </form>
      )}
    </form.Form>
  );
}

function App() {
  return (
    <StrictMode>
      <main>
        <Order />
        <Order />
      </main>
    </StrictMode>
  );
}

it("hydrates server HTML with no warning and matching ids", async () => {
  const html = renderToString(<App />);
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const serverIds = [...container.querySelectorAll("[id]")].map((element) => element.id);
  expect(new Set(serverIds).size).toBe(serverIds.length);
  expect(serverIds.length).toBeGreaterThan(8);

  const errors = vi.spyOn(console, "error");
  const recoverable = vi.fn<(error: unknown) => void>();
  await act(async () => {
    hydrateRoot(container, <App />, { onRecoverableError: recoverable });
  });
  expect(recoverable).not.toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();

  expect([...container.querySelectorAll("[id]")].map((element) => element.id)).toEqual(serverIds);
  const formElements = container.querySelectorAll("form");
  expect(formElements).toHaveLength(2);
  const customer = container.querySelector<HTMLInputElement>(`#${CSS.escape(`${formElements[0]?.id}--customer`)}`);
  expect(customer?.value).toBe("Ada");
  container.remove();
});
