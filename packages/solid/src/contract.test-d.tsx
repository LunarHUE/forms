import type {
  ArrayHandle,
  DisabledInvalid,
  FieldSnapshot,
  FormError,
  FormStore,
  ItemHandle,
  LeafHandle,
  ObjectHandle,
  StandardSchemaV1,
  Submission,
} from "@lunarhue/forms-core";
import { valibot } from "@lunarhue/forms-schema/valibot";
import { For, Show, type Accessor } from "solid-js";
import * as v from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import {
  branch,
  createDisabledErrors,
  createField,
  createForms,
  createFormState,
  createInputProps,
  createItems,
  createSubmit,
  createValidator,
  errorId,
  Field,
  fieldRef,
  FormContext,
  Items,
  useFormStore,
  type CheckableProps,
  type FieldState,
  type FormState,
  type NumberInputProps,
  type SelectProps,
  type SolidFormDefinition,
  type TextareaProps,
  type TextInputProps,
} from "./index.js";

const forms = createForms({ schemas: [valibot()] });

const signupSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, "Required")),
  age: v.number(),
  subscribe: v.boolean(),
  plan: v.picklist(["free", "pro"]),
  bio: v.string(),
  tags: v.array(v.string()),
  address: v.object({ city: v.string(), zip: v.string() }),
  rows: v.array(v.object({ title: v.string(), qty: v.number() })),
});

// The form value as the adapter's defaults leave it: numbers start undefined.
interface Row {
  title: string;
  qty: number | undefined;
}
interface SignupDraft {
  name: string;
  age: number | undefined;
  subscribe: boolean;
  plan: "free" | "pro" | undefined;
  bio: string;
  tags: string[];
  address: { city: string; zip: string };
  rows: Row[];
}

const Signup = forms.define({
  schema: signupSchema,
  onSubmit: (value, ctx: { intent: "save" | "publish" | undefined }) => ({ id: value.name, intent: ctx.intent }),
});

type SignupResult = { id: string; intent: "save" | "publish" | undefined };
type SignupStore = FormStore<SignupDraft, FormError, "save" | "publish" | undefined, SignupResult>;

// A schema type no registered adapter supports.
interface OtherSchema extends StandardSchemaV1<{ title: string }> {
  readonly other: true;
}
declare const otherSchema: OtherSchema;

// A nested field rendered through Field, with no provider above it.
function City(props: { form: FormStore<SignupDraft> }) {
  return (
    <Field handle={props.form.root.at("address").at("city")} validate={(value) => (value ? null : { message: "Required" })}>
      {(field, handle) => {
        expectTypeOf(field.value).toEqualTypeOf<string>();
        expectTypeOf(handle).toEqualTypeOf<LeafHandle<string>>();
        return (
          <label>
            City
            <input {...createInputProps(handle)} />
            <Show when={field.shownErrors[0]}>{(error) => <p id={errorId(handle)}>{error().message}</p>}</Show>
          </label>
        );
      }}
    </Field>
  );
}

// Array rows through Items.
function Rows(props: { rows: ArrayHandle<Row[]> }) {
  return (
    <Items handle={props.rows} fallback={<p>No rows</p>}>
      {(row, index) => {
        expectTypeOf(row).toEqualTypeOf<ItemHandle<Row>>();
        expectTypeOf(index).toEqualTypeOf<Accessor<number>>();
        return (
          <fieldset>
            <legend>Row {index() + 1}</legend>
            <input {...createInputProps(row.at("title"))} />
            <input {...createInputProps(row.at("qty"), { type: "number" })} />
            <button type="button" onClick={() => props.rows.remove(index())}>
              Remove
            </button>
          </fieldset>
        );
      }}
    </Items>
  );
}

// createItems' handles go straight to For.
function Tags(props: { tags: ArrayHandle<string[]> }) {
  const items = createItems(props.tags);
  return <For each={items()}>{(tag) => <input {...createInputProps(tag)} />}</For>;
}

// A store provided through context and read back typed by its definition.
function Page() {
  const form = Signup.createForm();
  return (
    <FormContext value={form}>
      <Summary />
    </FormContext>
  );
}
function Summary() {
  const form = useFormStore(Signup);
  expectTypeOf(form).toEqualTypeOf<SignupStore>();
  const name = createField(form.root.at("name"));
  return <p>{name.value}</p>;
}

// Every input kind spread on its element.
function Inputs() {
  const root = Signup.createForm().root;
  return (
    <>
      <input {...createInputProps(root.at("name"), { describedBy: "name-hint" })} />
      <textarea {...createInputProps(root.at("bio"), { type: "textarea" })} />
      <input {...createInputProps(root.at("age"), { type: "number" })} min={0} />
      <input {...createInputProps(root.at("subscribe"), { type: "checkbox" })} />
      <input {...createInputProps(root.at("tags"), { type: "checkbox", value: "news" })} />
      <input {...createInputProps(root.at("plan"), { type: "radio", value: "free" })} />
      <input {...createInputProps(root.at("plan"), { type: "radio", value: "pro" })} />
      <select {...createInputProps(root.at("plan"), { type: "select" })}>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>
      <div ref={fieldRef(root.at("address").at("zip"))} tabindex={0} />
    </>
  );
}

// Our ref and handler composed with the app's own.
function Name() {
  const props = createInputProps(Signup.createForm().root.at("name"));
  let element: HTMLInputElement | undefined;
  return (
    <input
      {...props}
      ref={[props.ref, (el) => (element = el)]}
      onInput={(event) => {
        props.onInput(event);
        element?.setCustomValidity("");
      }}
    />
  );
}

// The form element, an intent button, and the disabled-field errors.
function SignupForm() {
  const form = Signup.createForm();
  const submit = createSubmit(form, { onInvalid: (invalid) => invalid.field?.id });
  const state = createFormState(form);
  const disabledErrors = createDisabledErrors(form);
  return (
    <form {...submit.formProps}>
      <For each={disabledErrors()}>
        {(entry) => (
          <p>
            {entry.name}: {entry.errors[0]?.message}
          </p>
        )}
      </For>
      <button type="submit" disabled={state.submitting}>
        Save
      </button>
      <button type="button" onClick={() => void submit.submit("publish")}>
        Publish
      </button>
    </form>
  );
}

describe("defining and creating a form", () => {
  it("carries V, E, I and R from the definition with no annotations", () => {
    expectTypeOf(Signup).toEqualTypeOf<
      SolidFormDefinition<SignupDraft, FormError, "save" | "publish" | undefined, SignupResult>
    >();
    const form = Signup.createForm();
    expectTypeOf(form).toEqualTypeOf<SignupStore>();
    expectTypeOf(form.root).toEqualTypeOf<ObjectHandle<SignupDraft>>();
    // The core store still comes from createStore, for use outside components.
    expectTypeOf(Signup.createStore()).toEqualTypeOf(form);
    expectTypeOf(Signup.createForm(undefined, { id: "signup" })).toEqualTypeOf<SignupStore>();
  });

  it("passes per-store options through the function form", () => {
    const Lines = forms.define((count: number) => ({
      schema: v.object({ rows: v.array(v.object({ title: v.string() })) }),
      defaultValues: { rows: Array.from({ length: count }, () => ({ title: "" })) },
    }));
    expectTypeOf(Lines.createForm(3).root.at("rows")).toEqualTypeOf<ArrayHandle<{ title: string }[]>>();
    // @ts-expect-error: the function form needs its options
    Lines.createForm();
    // @ts-expect-error: the options are a number
    Lines.createForm("3");
  });

  it("types a plain form from defaultValues", () => {
    const Login = forms.define({ defaultValues: { email: "", remember: false } });
    const form = Login.createForm();
    expectTypeOf(form.root.at("email")).toEqualTypeOf<LeafHandle<string>>();
    expectTypeOf(createField(form.root.at("remember")).value).toEqualTypeOf<boolean>();
  });

  it("keeps a schema's Draft value as it is", () => {
    const form = Signup.createForm();
    expectTypeOf(createField(form.root.at("age")).value).toEqualTypeOf<number | undefined>();
    expectTypeOf(createField(form.root.at("plan")).value).toEqualTypeOf<"free" | "pro" | undefined>();
  });

  it("takes a schema no adapter supports when defaultValues is complete", () => {
    const Other = forms.define({ schema: otherSchema, defaultValues: { title: "" } });
    expectTypeOf(Other.createForm().root.at("title")).toEqualTypeOf<LeafHandle<string>>();
    // @ts-expect-error: no adapter supports this schema, so defaultValues is required
    forms.define({ schema: otherSchema });
  });
});

describe("intents and results", () => {
  it("requires an intent when undefined is not one", () => {
    const Post = forms.define({
      defaultValues: { title: "" },
      onSubmit: (_value, ctx: { intent: "draft" | "publish" }) => ctx.intent.length,
    });
    const submit = createSubmit(Post.createForm());
    expectTypeOf(submit.submit("draft")).toEqualTypeOf<Promise<Submission<"draft" | "publish", number>>>();
    // @ts-expect-error: the intent is required
    void submit.submit();
    // @ts-expect-error: "archive" is not an intent
    void submit.submit("archive");
  });

  it("reads the submission with its intent and result types", () => {
    const state = createFormState(Signup.createForm());
    expectTypeOf(state).toEqualTypeOf<FormState<"save" | "publish" | undefined, SignupResult>>();
    const submission = state.submission;
    if (submission.status === "succeeded") expectTypeOf(submission.result).toEqualTypeOf<SignupResult>();
    if (submission.status === "submitting")
      expectTypeOf(submission.intent).toEqualTypeOf<"save" | "publish" | undefined>();
  });

  it("reads the form state from a handle's store too", () => {
    const form = Signup.createForm();
    expectTypeOf(createFormState(form.root.at("name")).valid).toEqualTypeOf<boolean>();
  });
});

describe("a custom error type from mapError", () => {
  interface AppError {
    readonly code: string;
  }
  const appForms = createForms({ mapError: (raw): AppError => ({ code: raw.message }) });
  const Profile = appForms.define({ defaultValues: { handle: "", links: [{ url: "" }] } });

  it("flows to field state, validators, items and submit", () => {
    const form = Profile.createForm();
    const handle = createField(form.root.at("handle"));
    expectTypeOf(handle.errors).toEqualTypeOf<readonly AppError[]>();
    expectTypeOf(handle.shownErrors).toEqualTypeOf<readonly AppError[]>();
    createValidator(form.root.at("handle"), (value) => {
      expectTypeOf(value).toEqualTypeOf<string>();
      return value.includes(" ") ? { code: "space" } : undefined;
    });
    // @ts-expect-error: a validator returns the form's error type
    createValidator(form.root.at("handle"), () => ({ message: "no" }));
    const links = createItems(form.root.at("links"));
    expectTypeOf(links).toEqualTypeOf<Accessor<readonly ItemHandle<{ url: string }, AppError>[]>>();
    createSubmit(form, {
      onInvalid: (invalid) => {
        expectTypeOf(invalid.disabled).toEqualTypeOf<readonly DisabledInvalid<AppError>[]>();
        expectTypeOf(invalid.focused).toEqualTypeOf<HTMLElement | undefined>();
      },
    });
    expectTypeOf(createDisabledErrors(form)).toEqualTypeOf<Accessor<readonly DisabledInvalid<AppError>[]>>();
  });
});

describe("reading fields", () => {
  it("gives a field state shaped like the snapshot", () => {
    const form = Signup.createForm();
    const city = createField(form.root.at("address").at("city"));
    expectTypeOf(city).toEqualTypeOf<FieldState<string, FormError>>();
    expectTypeOf(city).toEqualTypeOf<FieldSnapshot<string>>();
    const rows = createField(form.root.at("rows"));
    expectTypeOf(rows.keys).toEqualTypeOf<readonly string[]>();
    expectTypeOf(rows.value).toEqualTypeOf<readonly { readonly title: string; readonly qty: number | undefined }[]>();
    // @ts-expect-error: field state is read-only
    city.value = "Paris";
  });

  it("narrows a union through core's branch with the field state", () => {
    type Method = { kind: "card"; number: string } | { kind: "iban"; iban: string };
    const defaults: { method: Method } = { method: { kind: "card", number: "" } };
    const method = forms.define({ defaultValues: defaults }).createForm().root.at("method");
    const card = branch(method, createField(method), "kind", "card");
    expectTypeOf(card).toEqualTypeOf<ObjectHandle<{ kind: "card"; number: string }> | undefined>();
  });

  it("rejects things that are not handles", () => {
    const form = Signup.createForm();
    expectTypeOf(createItems(form.root.at("tags"))).toEqualTypeOf<Accessor<readonly ItemHandle<string>[]>>();
    // @ts-expect-error: createField takes a handle
    createField({ id: "x" });
    // @ts-expect-error: createItems takes an array handle
    createItems(form.root.at("name"));
    // @ts-expect-error: an object handle has no items
    createItems(form.root.at("address"));
  });

  it("types a validator by the field", () => {
    const form = Signup.createForm();
    expectTypeOf(
      createValidator(form.root.at("age"), (value) => (value === undefined ? { message: "Required" } : null)),
    ).toBeVoid();
    createValidator(form.root.at("name"), v.pipe(v.string(), v.email()));
    createValidator(form.root.at("name"), { validate: (value) => (value ? [] : { message: "Required" }), debounce: 300 });
    createValidator(form.root.at("name"), false);
    // @ts-expect-error: a number schema doesn't fit a string field
    createValidator(form.root.at("name"), v.number());
  });
});

describe("components", () => {
  it("type-checks Field, Items and For with handles", () => {
    expectTypeOf(City).toBeFunction();
    expectTypeOf(Rows).toBeFunction();
    expectTypeOf(Tags).toBeFunction();
  });

  it("rejects a leaf handle on Items and the wrong children on Field", () => {
    const form = Signup.createForm();
    expectTypeOf(form.root.at("name")).toEqualTypeOf<LeafHandle<string>>();
    // @ts-expect-error: Items takes an array handle
    void (<Items handle={form.root.at("name")}>{() => <li />}</Items>);
    // @ts-expect-error: the field of a string has no keys
    void (<Field handle={form.root.at("name")}>{(field) => <p>{field.keys.length}</p>}</Field>);
  });
});

describe("context", () => {
  it("provides a store and reads it back typed by its definition", () => {
    expectTypeOf(Page).toBeFunction();
    expectTypeOf(Summary).toBeFunction();
  });

  it("reads an untyped store without a definition", () => {
    const form = useFormStore();
    expectTypeOf(form.root.at("anything").path).toEqualTypeOf<readonly (string | number)[]>();
  });
});

describe("input props", () => {
  it("picks the props by the options' type", () => {
    const root = Signup.createForm().root;
    expectTypeOf(createInputProps(root.at("name"))).toEqualTypeOf<TextInputProps>();
    expectTypeOf(createInputProps(root.at("name"), { type: "email" })).toEqualTypeOf<TextInputProps>();
    expectTypeOf(createInputProps(root.at("bio"), { type: "textarea" })).toEqualTypeOf<TextareaProps>();
    expectTypeOf(createInputProps(root.at("age"), { type: "number" })).toEqualTypeOf<NumberInputProps>();
    expectTypeOf(createInputProps(root.at("subscribe"), { type: "checkbox" })).toEqualTypeOf<CheckableProps>();
    expectTypeOf(createInputProps(root.at("tags"), { type: "checkbox", value: "news" })).toEqualTypeOf<CheckableProps>();
    expectTypeOf(createInputProps(root.at("plan"), { type: "radio", value: "pro" })).toEqualTypeOf<CheckableProps>();
    expectTypeOf(createInputProps(root.at("plan"), { type: "select" })).toEqualTypeOf<SelectProps>();
  });

  it("spreads onto the matching elements and composes with the app's own", () => {
    expectTypeOf(Inputs).toBeFunction();
    expectTypeOf(Name).toBeFunction();
  });

  it("needs empty for a number field that can't hold undefined", () => {
    const defaults: { qty: number; note: string | undefined } = { qty: 1, note: "" };
    const order = forms.define({ defaultValues: defaults }).createForm().root;
    expectTypeOf(createInputProps(order.at("qty"), { type: "number", empty: 0 })).toEqualTypeOf<NumberInputProps>();
    expectTypeOf(createInputProps(order.at("note"))).toEqualTypeOf<TextInputProps>();
    // @ts-expect-error: an empty input needs a number to write
    createInputProps(order.at("qty"), { type: "number" });
  });

  it("rejects an input kind the field's type doesn't fit", () => {
    const root = Signup.createForm().root;
    expectTypeOf(root.at("age")).toEqualTypeOf<LeafHandle<number | undefined>>();
    // @ts-expect-error: a number field is not text
    createInputProps(root.at("age"));
    // @ts-expect-error: a string field is not a number input
    createInputProps(root.at("name"), { type: "number" });
    // @ts-expect-error: a string field is not a checkbox
    createInputProps(root.at("name"), { type: "checkbox" });
    // @ts-expect-error: a union of literals takes no free text
    createInputProps(root.at("plan"));
    // @ts-expect-error: "team" is not a plan
    createInputProps(root.at("plan"), { type: "radio", value: "team" });
    // @ts-expect-error: a checkbox group's value is one of the array's items
    createInputProps(root.at("tags"), { type: "checkbox", value: 1 });
    // @ts-expect-error: an object is not an input
    createInputProps(root.at("address"));
    // @ts-expect-error: a boolean field is not a select
    createInputProps(root.at("subscribe"), { type: "select" });
  });
});

describe("submit", () => {
  it("wires the form element, intents and the failed-submit focus", () => {
    expectTypeOf(SignupForm).toBeFunction();
  });

  it("rejects an intent the definition doesn't name", () => {
    const submit = createSubmit(Signup.createForm());
    expectTypeOf(submit.handleSubmit()).toEqualTypeOf<Promise<void>>();
    // @ts-expect-error: "archive" is not an intent
    void submit.submit("archive");
  });
});
