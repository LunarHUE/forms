import { describe, expectTypeOf, it } from "vitest";
import type { ComponentProps } from "react";
import {
  createForms,
  type AnyFieldHandle,
  type ArrayHandle,
  type DisabledInvalid,
  type FieldSnapshot,
  type FormError,
  type FormInstance,
  type FormSnapshot,
  type FormStore,
  type ItemHandle,
  type LeafHandle,
  type ObjectHandle,
  type ReactFormDefinition,
  type SchemaAdapter,
  type StandardSchemaV1,
  type Submission,
  useDisabledErrors,
  useField,
  useFormState,
} from "./index.js";

// A schema type an adapter supports, as in core's type tests. No schema library is needed.
interface FakeSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly fake: true;
}
declare const fakeAdapter: SchemaAdapter<FakeSchema<unknown>>;

interface Signup {
  name: string;
  age: number;
  terms: boolean;
  address: { city: string; zip: string };
  rows: { title: string; qty: number }[];
}
declare const signupSchema: FakeSchema<Signup>;

// The draft the adapter's defaults leave: numbers start undefined.
interface DraftSignup {
  name: string;
  age: number | undefined;
  terms: boolean;
  address: { city: string; zip: string };
  rows: { title: string; qty: number | undefined }[];
}
type Row = DraftSignup["rows"][number];

const forms = createForms({ schemas: [fakeAdapter] });
const signup = forms.define({
  schema: signupSchema,
  onSubmit: (value) => {
    expectTypeOf(value).toEqualTypeOf<Signup>();
    return { saved: true as const };
  },
});

function SignupForm() {
  const form = signup.useForm();
  expectTypeOf(form).toEqualTypeOf<FormInstance<DraftSignup, FormError, undefined, { saved: true }>>();
  expectTypeOf(form.root).toEqualTypeOf<ObjectHandle<DraftSignup>>();
  expectTypeOf(form.root.at("age")).toEqualTypeOf<LeafHandle<number | undefined>>();
  expectTypeOf(form.root.at("address").at("city")).toEqualTypeOf<LeafHandle<string>>();
  expectTypeOf(form.submit()).toEqualTypeOf<Promise<Submission<undefined, { saved: true }>>>();

  const state = useFormState(form);
  expectTypeOf(state).toEqualTypeOf<FormSnapshot<undefined, { saved: true }>>();
  const submitting = useFormState(form, (snapshot) => snapshot.submitting);
  expectTypeOf(submitting).toEqualTypeOf<boolean>();
  // @ts-expect-error: the form snapshot has no `value`
  useFormState(form, (snapshot) => snapshot.value);

  return (
    <form {...form.formProps}>
      <Status city={form.root.at("address").at("city")} />
      <Rows rows={form.root.at("rows")} />
    </form>
  );
}

function SignupWithSettings() {
  const form = signup.useForm({
    id: "signup",
    focusOnInvalid: (target) => {
      expectTypeOf(target.field).toEqualTypeOf<AnyFieldHandle | undefined>();
      expectTypeOf(target.disabled).toEqualTypeOf<readonly DisabledInvalid[]>();
      target.element?.focus();
    },
  });
  // @ts-expect-error: a plain config takes no options, only the instance settings
  signup.useForm({ user: 1 }, { id: "x" });
  return <form {...form.formProps} />;
}

const edit = forms.define((options: { user: Signup }) => ({ schema: signupSchema, defaultValues: options.user }));

function EditForm({ user }: { readonly user: Signup }) {
  const form = edit.useForm({ user }, { id: "edit" });
  // @ts-expect-error: the definition takes options
  edit.useForm();
  return <form {...form.formProps} />;
}

// Reads the form state from a handle's store, with no provider and no form instance.
function Status({ city }: { readonly city: LeafHandle<string> }) {
  const state = useFormState(city.store);
  expectTypeOf(state.submitting).toEqualTypeOf<boolean>();
  return <p>{state.submitCount}</p>;
}

function Qty({ row }: { readonly row: ItemHandle<Row> }) {
  const qty = useField(row.at("qty"));
  expectTypeOf(qty.value).toEqualTypeOf<number | undefined>();
  return <span>{qty.value}</span>;
}

function Rows({ rows }: { readonly rows: ArrayHandle<Row[]> }) {
  const keys = useField(rows, (snapshot) => snapshot.keys);
  expectTypeOf(keys).toEqualTypeOf<readonly string[]>();
  return <Qty row={rows.item(keys[0] ?? "")} />;
}

const order = forms.define({
  defaultValues: { item: "" },
  onSubmit: (_value, ctx: { intent: "save" | "publish" }) => ctx.intent.length,
});

function OrderForm() {
  const form = order.useForm();
  const { submit } = form;
  expectTypeOf(submit).parameters.toEqualTypeOf<[intent: "save" | "publish"]>();
  // @ts-expect-error: this form has no undefined intent
  void submit();
  // @ts-expect-error: not one of the intents
  void submit("delete");
  const state = useFormState(form);
  expectTypeOf(state.submission).toEqualTypeOf<Submission<"save" | "publish", number>>();
  return (
    <button type="button" onClick={() => void submit("publish")}>
      Publish
    </button>
  );
}

interface AppError {
  readonly code: string;
  readonly text: string;
}
const appForms = createForms({ mapError: (raw): AppError => ({ code: raw.source, text: raw.message }) });
const login = appForms.define({ defaultValues: { user: "", pin: 0 } });

function LoginForm() {
  const form = login.useForm();
  const user = useField(form.root.at("user"));
  expectTypeOf(user).toEqualTypeOf<FieldSnapshot<string, AppError>>();
  expectTypeOf(user.shownErrors).toEqualTypeOf<readonly AppError[]>();
  const blocked = useDisabledErrors(form);
  expectTypeOf(blocked).toEqualTypeOf<readonly DisabledInvalid<AppError>[]>();
  return <form {...form.formProps}>{user.shownErrors.map((error) => error.text).join(", ")}</form>;
}

describe("createForms and define", () => {
  it("carries V, E, I and R from the definition, with V as the draft", () => {
    expectTypeOf(signup).toEqualTypeOf<ReactFormDefinition<DraftSignup, FormError, undefined, { saved: true }>>();
    expectTypeOf(signup.createStore()).toEqualTypeOf<FormStore<DraftSignup, FormError, undefined, { saved: true }>>();
  });

  it("defines plain forms from defaultValues", () => {
    const plain = forms.define({ defaultValues: { email: "", tags: [] as string[] } });
    expectTypeOf(plain).toEqualTypeOf<ReactFormDefinition<{ email: string; tags: string[] }>>();
    // @ts-expect-error: without a schema defaultValues is required
    forms.define({ onSubmit: () => {} });
  });

  it("types a function definition's options", () => {
    expectTypeOf(edit).toEqualTypeOf<ReactFormDefinition<DraftSignup, FormError, undefined, unknown, { user: Signup }>>();
  });
});

describe("formProps", () => {
  it("fits a <form> element's props", () => {
    type FormElementOnSubmit = NonNullable<ComponentProps<"form">["onSubmit"]>;
    expectTypeOf<FormInstance<DraftSignup>["formProps"]["onSubmit"]>().toExtend<FormElementOnSubmit>();
    expectTypeOf<FormInstance<DraftSignup>["formProps"]>().toExtend<ComponentProps<"form">>();
  });
});

describe("components typecheck as app code", () => {
  it("covers useForm, settings, options, intents, a custom error type and handles as props", () => {
    expectTypeOf(SignupForm).toBeFunction();
    expectTypeOf(SignupWithSettings).toBeFunction();
    expectTypeOf(EditForm).toBeFunction();
    expectTypeOf(OrderForm).toBeFunction();
    expectTypeOf(LoginForm).toBeFunction();
  });
});
