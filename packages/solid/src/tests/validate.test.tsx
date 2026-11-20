import { createSignal, For, Show } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { debounced, validateOn, type Choice, createForm, createForms, type FieldApi, type FormOf, type HandleOf, inputProps, type ValidatorInput, fieldValidators } from "../index.js";
import { click, get, mount, settle, typeText } from "./dom.js";

/** The props each registered component was given, by label. */
const given: Record<string, readonly string[]> = {};

function TextField(props: { field: FieldApi<string>; label: string }) {
  given[props.label] = Object.keys(props);
  return (
    <label>
      {props.label}
      <input data-label={props.label} {...inputProps(props.field)} />
      <span data-errors={props.label}>{props.field.errors.map((error) => error.message).join(",")}</span>
    </label>
  );
}

const forms = createForms({ fields: { TextField } });
const Signup = forms.define({
  defaultValues: { email: "", name: "", home: { city: "" } },
  validate: { fields: fieldValidators({ name: (value) => (value === "" ? { message: "definition" } : undefined) }) },
});
type SignupForm = FormOf<typeof Signup>;

const errorsOf = (host: HTMLElement, label: string): string => host.querySelector(`[data-errors="${label}"]`)?.textContent ?? "";
const messages = (form: SignupForm, name: "email" | "name"): string[] => form.root.at(name).peek().errors.map((error) => error.message);
const work = (value: string) => (value.endsWith("@x.io") ? undefined : { message: "work email" });

type Check = (value: string) => string | undefined;
const toError = (message: string | undefined) => (message === undefined ? undefined : { message });

/**
 * A bound component and a `Field`, each with a validate prop, under a switch.
 * `check` is an accessor, so the `Field`'s prop is reactive.
 */
function mountSignup(check: () => Check, debounce?: number) {
  const [shown, setShown] = createSignal(true);
  const holder: { form?: SignupForm } = {};
  const nameValidator = (): ValidatorInput<string> => {
    const current = check();
    const validate = (value: string) => toError(current(value));
    return debounce === undefined ? validate : debounced(validate, debounce);
  };
  function Page() {
    const own = createForm(Signup);
    holder.form = own;
    return (
      <Show when={shown()}>
        <own.TextField name="email" label="Email" validate={(value) => work(value)} />
        <own.Field name="name" validate={nameValidator()}>
          {(field) => (
            <>
              <input data-label="Name" {...inputProps(field)} />
              <span data-errors="Name">{field.errors.map((error) => error.message).join(",")}</span>
            </>
          )}
        </own.Field>
      </Show>
    );
  }
  const { host } = mount(() => <Page />);
  const { form } = holder;
  if (form === undefined) throw new Error("no form rendered");
  return { host, form, setShown };
}

/** A fieldset whose scope component takes a validate prop. */
const Home = forms.fieldset<{ city: string }>();
function HomeFields(props: { field: HandleOf<typeof Home> }) {
  const scope = Home.scope(props.field);
  return <scope.TextField name="city" label="City" validate={(value) => (value.length < 3 ? { message: "short city" } : undefined)} />;
}
function WithHome() {
  const form = createForm(Signup);
  return <HomeFields field={form.root.at("home")} />;
}

/** A registered radio group written with `Choice`. */
function RadioGroupField(props: { field: FieldApi<Choice>; options: readonly Choice[] }) {
  return <For each={props.options}>{(option) => <input data-option={option} {...inputProps(props.field, { kind: "radio", value: option })} />}</For>;
}

const choiceForms = createForms({ fields: { RadioGroupField } });
const deliveryStart: { method: "post" | "pickup" } = { method: "post" };
const Delivery = choiceForms.define({ defaultValues: deliveryStart });

describe("the validate prop", () => {
  it("keeps the timing a wrapped check sets", async () => {
    const { host } = mount(() => {
      const form = createForm(Signup);
      return <form.TextField name="email" label="Email" validate={validateOn(work, "input")} />;
    });
    typeText(get(host, "[data-label=Email]"), "ada@y.io");
    await settle();
    expect(errorsOf(host, "Email")).toBe("work email");
  });

  it("runs on the form's timing, shows its errors, and never reaches the registered component", async () => {
    const { host } = mountSignup(() => () => undefined);
    const email = get(host, "[data-label=Email]");
    typeText(email, "ada@y.io");
    await settle();
    expect(errorsOf(host, "Email")).toBe("");
    email.dispatchEvent(new FocusEvent("blur"));
    await settle();
    expect(errorsOf(host, "Email")).toBe("work email");
    typeText(email, "ada@x.io");
    await settle();
    expect(errorsOf(host, "Email")).toBe("");
    expect(new Set(given["Email"])).toEqual(new Set(["field", "label"]));
  });

  it("works on a registered component written with Choice", async () => {
    const holder: { form?: FormOf<typeof Delivery> } = {};
    const { host } = mount(() => {
      const form = createForm(Delivery);
      holder.form = form;
      return (
        <form.RadioGroupField
          name="method"
          options={["post", "pickup"]}
          validate={(value) => (value === "pickup" ? { message: "no pickup" } : undefined)}
        />
      );
    });
    click(get(host, "[data-option=pickup]"));
    const { form } = holder;
    if (form === undefined) throw new Error("no form rendered");
    await form.store.validate();
    expect(form.root.at("method").peek().errors.map((error) => error.message)).toEqual(["no pickup"]);
  });

  it("works on a scope's components", async () => {
    const { host } = mount(() => <WithHome />);
    const city = get(host, "[data-label=City]");
    typeText(city, "Os");
    city.dispatchEvent(new FocusEvent("blur"));
    await settle();
    expect(errorsOf(host, "City")).toBe("short city");
  });

  it("removes the validator and its errors on unmount, and keeps the definition's", async () => {
    const { form, setShown } = mountSignup(() => (value) => (value === "" ? "prop" : undefined));
    await form.store.validate();
    expect(messages(form, "email")).toEqual(["work email"]);
    expect(messages(form, "name")).toEqual(["definition", "prop"]);
    setShown(false);
    await settle();
    expect(messages(form, "email")).toEqual([]);
    expect(messages(form, "name")).toEqual(["definition"]);
    await form.store.validate();
    expect(messages(form, "email")).toEqual([]);
    expect(messages(form, "name")).toEqual(["definition"]);
  });

  it("calls the function a reactive prop gives now, without registering again", async () => {
    const first = vi.fn<Check>((value) => (value === "" ? "first" : undefined));
    const second = vi.fn<Check>((value) => (value === "" ? "second" : undefined));
    const [which, setWhich] = createSignal<"first" | "second">("first");
    const { host, form } = mountSignup(() => (which() === "first" ? first : second));
    setWhich("second");
    await settle();
    await form.root.at("name").validate();
    await settle();
    expect(errorsOf(host, "Name")).toBe("definition,second");
    expect(first).not.toHaveBeenCalled();
    // One registration: a second registered validator would call it twice.
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("takes a debounced check", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const check = vi.fn<Check>((value) => (value.length < 3 ? "short" : undefined));
    const { host } = mountSignup(() => check, 200);
    const name = get(host, "[data-label=Name]");
    typeText(name, "a");
    name.dispatchEvent(new FocusEvent("blur"));
    typeText(name, "ab");
    const calls = check.mock.calls.length;
    await vi.advanceTimersByTimeAsync(100);
    expect(check.mock.calls.length).toBe(calls);
    await vi.advanceTimersByTimeAsync(200);
    await settle();
    expect(check).toHaveBeenLastCalledWith("ab");
    expect(errorsOf(host, "Name")).toBe("short");
    vi.useRealTimers();
  });
});

const required = (value: string) => (value === "" ? { message: "required" } : undefined);

describe("a form with no plugins", () => {
  it("runs the validate prop and field.validate(), and shows the errors", async () => {
    const Bare = createForms().define({ defaultValues: { name: "" } });
    const holder: { form?: FormOf<typeof Bare> } = {};
    const { host } = mount(() => {
      const form = createForm(Bare);
      holder.form = form;
      return (
        <form.Field name="name" validate={required}>
          {(field) => <span data-errors="Name">{field.errors.map((error) => error.message).join(",")}</span>}
        </form.Field>
      );
    });
    const name = holder.form?.root.at("name");
    expect(await name?.validate()).toBe(false);
    await settle();
    expect(errorsOf(host, "Name")).toBe("required");
    expect(name?.peek().errors).toEqual([{ message: "required" }]);
  });
});
