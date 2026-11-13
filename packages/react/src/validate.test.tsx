import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { type Choice, createForms, type FieldApi, type FormOf, type HandleOf, useForm, type ValidatorInput } from "./index.js";
import { validation } from "./plugins/validation.js";

/** A registered text field that shows its errors and records the props it was given. */
const given: Record<string, unknown>[] = [];
function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  useEffect(() => {
    given.push({ ...props });
  });
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps()} />
      <span role="status" aria-label={`${props.label} errors`}>
        {props.field.errors.map((error) => error.message).join(",")}
      </span>
    </label>
  );
}

const forms = createForms({ plugins: [validation()], fields: { TextField } });
const signup = forms.define({
  defaultValues: { email: "", name: "", home: { city: "" } },
  validate: { fields: { name: (value) => (value === "" ? { message: "definition" } : undefined) } },
});
type SignupForm = FormOf<typeof signup>;

const holder: { form?: SignupForm } = {};
const current = (): SignupForm => {
  if (holder.form === undefined) throw new Error("no form rendered");
  return holder.form;
};

const errorsOf = (label: string): string => screen.getByLabelText(`${label} errors`).textContent ?? "";
const work = (value: string) => (value.endsWith("@x.io") ? undefined : { message: "work email" });

type Check = (value: string) => string | undefined;
const toError = (message: string | undefined) => (message === undefined ? undefined : { message });

/** A form with one bound field and one `Field`, each with a validate prop, and a switch to unmount both. */
function Signup(props: { readonly check?: Check; readonly debounce?: number }) {
  const form = useForm(signup);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    holder.form = form;
  });
  const check = props.check ?? (() => undefined);
  const input: ValidatorInput<string> =
    props.debounce === undefined ? (value) => toError(check(value)) : { validate: (value) => toError(check(value)), debounce: props.debounce };
  return (
    <>
      <button type="button" onClick={() => setShown(!shown)}>
        toggle
      </button>
      {shown && (
        <>
          <form.TextField name="email" label="Email" validate={(value) => work(value)} />
          <form.Field name="name" validate={input}>
            {(field) => (
              <label>
                Name
                <input {...field.inputProps()} />
                <span role="status" aria-label="Name errors">
                  {field.errors.map((error) => error.message).join(",")}
                </span>
              </label>
            )}
          </form.Field>
        </>
      )}
    </>
  );
}

/** A fieldset whose scope component takes a validate prop. */
const Home = forms.fieldset<{ city: string }>();
function HomeFields(props: { readonly field: HandleOf<typeof Home> }) {
  const scope = Home.scope(props.field);
  return <scope.TextField name="city" label="City" validate={(value) => (value.length < 3 ? { message: "short city" } : undefined)} />;
}
function WithHome() {
  const form = useForm(signup);
  return <HomeFields field={form.root.at("home")} />;
}

/** A registered radio group written with `Choice`. */
function RadioGroupField(props: { readonly field: FieldApi<Choice>; readonly options: readonly Choice[] }) {
  return (
    <>
      {props.options.map((option) => (
        <label key={option}>
          {option}
          <input {...props.field.inputProps({ kind: "radio", value: option })} />
        </label>
      ))}
    </>
  );
}

const choiceForms = createForms({ plugins: [validation()], fields: { RadioGroupField } });
const deliveryStart: { method: "post" | "pickup" } = { method: "post" };
const delivery = choiceForms.define({ defaultValues: deliveryStart });
const deliveryHolder: { form?: FormOf<typeof delivery> } = {};
function Delivery() {
  const form = useForm(delivery);
  useEffect(() => {
    deliveryHolder.form = form;
  });
  return (
    <form.RadioGroupField
      name="method"
      options={["post", "pickup"]}
      validate={(value) => (value === "pickup" ? { message: "no pickup" } : undefined)}
    />
  );
}

describe("the validate prop", () => {
  it("runs on the form's timing, shows its errors, and never reaches the registered component", () => {
    given.length = 0;
    render(<Signup />);
    const email = screen.getByLabelText("Email");
    fireEvent.change(email, { target: { value: "ada@y.io" } });
    expect(errorsOf("Email")).toBe("");
    fireEvent.blur(email);
    expect(errorsOf("Email")).toBe("work email");
    fireEvent.change(email, { target: { value: "ada@x.io" } });
    expect(errorsOf("Email")).toBe("");
    expect(given.length).toBeGreaterThan(0);
    for (const props of given) expect(new Set(Object.keys(props))).toEqual(new Set(["field", "label"]));
  });

  it("works on a registered component written with Choice", async () => {
    render(<Delivery />);
    fireEvent.click(screen.getByLabelText("pickup"));
    const form = deliveryHolder.form;
    if (form === undefined) throw new Error("no form rendered");
    await act(async () => {
      await form.store.validate();
    });
    expect(form.root.at("method").peek().errors.map((error) => error.message)).toEqual(["no pickup"]);
  });

  it("works on a scope's components", () => {
    render(<WithHome />);
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Os" } });
    fireEvent.blur(screen.getByLabelText("City"));
    expect(errorsOf("City")).toBe("short city");
  });

  it("removes the validator and its errors on unmount, and keeps the definition's", async () => {
    render(<Signup check={(value) => (value === "" ? "prop" : undefined)} />);
    await act(async () => {
      await current().store.validate();
    });
    expect(current().root.at("email").peek().errors.map((error) => error.message)).toEqual(["work email"]);
    expect(current().root.at("name").peek().errors.map((error) => error.message)).toEqual(["definition", "prop"]);
    fireEvent.click(screen.getByText("toggle"));
    expect(current().root.at("email").peek().errors).toEqual([]);
    expect(current().root.at("name").peek().errors.map((error) => error.message)).toEqual(["definition"]);
    await act(async () => {
      await current().store.validate();
    });
    expect(current().root.at("email").peek().errors).toEqual([]);
    expect(current().root.at("name").peek().errors.map((error) => error.message)).toEqual(["definition"]);
  });

  it("registers once for an inline function and calls the latest one", async () => {
    const first = vi.fn<Check>((value) => (value === "" ? "first" : undefined));
    const second = vi.fn<Check>((value) => (value === "" ? "second" : undefined));
    const { rerender } = render(<Signup check={first} />);
    rerender(<Signup check={second} />);
    rerender(<Signup check={second} />);
    await act(async () => {
      await current().root.at("name").validate();
    });
    expect(errorsOf("Name")).toBe("definition,second");
    expect(first).not.toHaveBeenCalled();
    // One registration: a second registered validator would call it twice.
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("takes an options object with debounce", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const check = vi.fn<Check>((value) => (value.length < 3 ? "short" : undefined));
    render(<Signup check={check} debounce={200} />);
    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "a" } });
    fireEvent.blur(name);
    fireEvent.change(name, { target: { value: "ab" } });
    const calls = check.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(check.mock.calls.length).toBe(calls);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(check).toHaveBeenLastCalledWith("ab");
    expect(errorsOf("Name")).toBe("short");
    vi.useRealTimers();
  });
});
