import { act } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createForms, type FieldApi, useField, useFormContext, useFormState, useInputProps } from "./index.js";
import { type Commits, useCommits } from "./test/helpers.js";

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

const commits: Commits = new Map();

function CountedText(props: { readonly field: FieldApi<string>; readonly label: string }) {
  useCommits(commits, props.label);
  return <input aria-label={props.label} {...props.field.inputProps()} />;
}

function CountedNumber(props: { readonly field: FieldApi<number>; readonly label: string }) {
  useCommits(commits, props.label);
  return <input aria-label={props.label} {...props.field.inputProps({ kind: "number" })} />;
}

function Counted(props: { readonly name: string; readonly children: ReactNode }) {
  useCommits(commits, props.name);
  return props.children;
}

interface Trip {
  title: string;
  stops: { place: string; nights: number }[];
}
const counted = createForms({ fields: { CountedText, CountedNumber } });
const tour: Trip = { title: "Tour", stops: [{ place: "Oslo", nights: 2 }] };
const trip = counted.define({ defaultValues: tour });

function TripForm() {
  const form = trip.useForm({ id: "trip" });
  const title = useField(form.root.at("title"));
  return (
    <form {...form.formProps}>
      <Counted name="useField">{title.value}</Counted>
      <form.CountedText name="title" label="title" />
      <form.Field name="title">
        {(field) => (
          <Counted name="Field">
            <input aria-label="Field" {...field.inputProps()} />
          </Counted>
        )}
      </form.Field>
      <form.Field name="title" select={(snapshot) => snapshot.value}>
        {(value) => <Counted name="Field select">{value}</Counted>}
      </form.Field>
      <form.Items name="stops">
        {(stop) => {
          const scope = counted.scope(stop);
          return (
            <Counted name="Items">
              <scope.CountedText name="place" label="scope text" />
              <scope.CountedNumber name="nights" label="scope number" />
            </Counted>
          );
        }}
      </form.Items>
    </form>
  );
}

it("commits each field once when it hydrates", async () => {
  const container = document.body.appendChild(document.createElement("div"));
  container.innerHTML = renderToString(<TripForm />);
  // No StrictMode here, so each effect run is one commit.
  await act(async () => {
    hydrateRoot(container, <TripForm />);
  });
  expect(Object.fromEntries(commits)).toEqual({
    useField: 1,
    title: 1,
    Field: 1,
    "Field select": 1,
    Items: 1,
    "scope text": 1,
    "scope number": 1,
  });
  container.remove();
});
