import type {
  NamedArrayHandle,
  DisabledInvalid,
  NamedFieldHandle,
  FormError,
  FormStore,
  HandleBase,
  NamedItemHandle,
  NamedLeafHandle,
  NamedObjectHandle,
  Submission,
} from "@lunarhue/forms-core";
import { valibot } from "@lunarhue/forms-schema/valibot";
import { arrays } from "./plugins.js";
import { For, Match, Show, Switch, type Accessor } from "solid-js";
import * as v from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import {
  debounced,
  Items,
  createDisabledErrors,
  createField,
  createForm,
  createForms,
  createItems,
  createValidator,
  errorId,
  fieldRef,
  checkboxGroupProps,
  checkboxProps,
  inputProps,
  numberProps,
  radioProps,
  rangeProps,
  selectProps,
  textareaProps,
  useFormContext,
  type AnyForm,
  type CheckboxGroupInputProps,
  type CheckboxInputProps,
  type ExactFieldApi,
  type FieldApi,
  type FieldPath,
  type FormOf,
  type PathMaxDepth,
  type FormState,
  type HandleOf,
  type NumberInputProps,
  type RadioInputProps,
  type RangeInputProps,
  type Scope,
  type SelectProps,
  type SolidForm,
  type TextareaProps,
  type TextInputProps,
} from "./index.js";

// The app's own field components. Each takes a `field` prop and props of its own.
function TextField(props: { field: FieldApi<string>; label: string; placeholder?: string }) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field)} placeholder={props.placeholder} />
      <Show when={props.field.shownErrors[0]}>{(error) => <p id={props.field.errorId}>{error().message}</p>}</Show>
    </label>
  );
}
function NumberField(props: { field: FieldApi<number>; label: string }) {
  return (
    <label>
      {props.label}
      <input {...numberProps(props.field)} />
    </label>
  );
}

const forms = createForms({ plugins: [valibot(), arrays()], fields: { TextField, NumberField } });

// A component that takes an exact field object, with no Draft.
function ExactCount(props: { field: ExactFieldApi<number>; label: string }) {
  return (
    <span>
      {props.label} {props.field.value}
    </span>
  );
}
const exactForms = createForms({ fields: { ExactCount } });

const AddressSchema = v.object({
  street: v.string(),
  city: v.pipe(v.string(), v.minLength(1, "Required")),
  zip: v.string(),
  geo: v.object({ lat: v.number(), lng: v.number() }),
});

const signupSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1, "Required")),
  age: v.number(),
  subscribe: v.boolean(),
  plan: v.picklist(["free", "pro"]),
  bio: v.string(),
  tags: v.array(v.string()),
  channels: v.array(v.picklist(["email", "sms"])),
  billing: AddressSchema,
  shipping: AddressSchema,
  rows: v.array(v.object({ title: v.string(), qty: v.number(), address: AddressSchema })),
});

// The values as the adapter's defaults leave them: numbers start undefined.
interface Geo {
  lat: number | undefined;
  lng: number | undefined;
}
interface Address {
  street: string;
  city: string;
  zip: string;
  geo: Geo;
}
interface Row {
  title: string;
  qty: number | undefined;
  address: Address;
}
interface SignupDraft {
  name: string;
  age: number | undefined;
  subscribe: boolean;
  plan: "free" | "pro" | undefined;
  bio: string;
  tags: string[];
  channels: ("email" | "sms")[];
  billing: Address;
  shipping: Address;
  rows: Row[];
}
type Intent = "save" | "publish" | undefined;
type SignupResult = { id: string; intent: Intent };
type Fields = { readonly TextField: typeof TextField; readonly NumberField: typeof NumberField };
type Installed = readonly [ReturnType<typeof valibot>, ReturnType<typeof arrays>];
type SignupForm = SolidForm<SignupDraft, FormError, Intent, SignupResult, Fields, Installed>;

const Signup = forms.define({
  schema: signupSchema,
  onSubmit: (value, ctx: { intent: Intent }) => ({ id: value.name, intent: ctx.intent }),
});

// Fieldsets: a shape token, then an ordinary component that asks for its scope.
const AddressShape = forms.fieldset(AddressSchema);
const GeoShape = forms.fieldset<Geo>();

function GeoFields(props: { field: HandleOf<typeof GeoShape> }) {
  const scope = GeoShape.scope(props.field);
  expectTypeOf(scope).toEqualTypeOf<Scope<Geo, FormError, Fields, "valibot" | "arrays">>();
  return (
    <>
      <scope.NumberField name="lat" label="Latitude" />
      <scope.NumberField name="lng" label="Longitude" />
    </>
  );
}

function AddressFields(props: { field: HandleOf<typeof AddressShape>; title: string }) {
  const scope = AddressShape.scope(props.field);
  expectTypeOf(scope.root).toEqualTypeOf<NamedObjectHandle<Address, FormError, "valibot" | "arrays">>();
  return (
    <fieldset>
      <legend>{props.title}</legend>
      <scope.TextField name="street" label="Street" />
      <scope.TextField name="city" label="City" />
      <scope.Field name="zip">{(field) => <input {...inputProps(field)} />}</scope.Field>
      <scope.Field name="geo.lat">{(field) => <span>{field.value}</span>}</scope.Field>
      {/* @ts-expect-error: names are typed against the shape */}
      <scope.Field name="country">{() => null}</scope.Field>
      <GeoFields field={scope.root.at("geo")} />
    </fieldset>
  );
}

// A reusable part that needs only the nearest form.
function SubmitButton(props: { label: string }) {
  const form = useFormContext();
  expectTypeOf(form).toEqualTypeOf<AnyForm>();
  return (
    <button type="submit" disabled={form.state.submitting}>
      {props.label}
    </button>
  );
}

// A part that reads its own definition's form, typed.
function SignupSummary() {
  const form = useFormContext(Signup);
  expectTypeOf(form).toEqualTypeOf<SignupForm>();
  return <form.Field name="name">{(field) => <p>{field.value}</p>}</form.Field>;
}

function SignupPage() {
  const form = createForm(Signup);
  const disabledErrors = createDisabledErrors(form);
  return (
    <form.Form>
      {(props, owner) => (
        <form {...props}>
          <form.TextField name="name" label="Name" placeholder="Ada" />
          <form.NumberField name="age" label="Age" />
          <form.Field name="billing.city">{(field) => <input {...inputProps(field, { type: "text" })} />}</form.Field>
          <Items handle={form.root.at("rows")} fallback={<p>No rows</p>}>
            {(row, index) => (
              <fieldset>
                <legend>Row {index() + 1}</legend>
                <form.TextField handle={row.at("title")} label="Title" />
                <form.NumberField handle={row.at("qty")} label="Qty" />
                <AddressFields field={row.at("address")} title="Row address" />
                <button type="button" onClick={() => form.root.at("rows").remove(index())}>
                  Remove
                </button>
              </fieldset>
            )}
          </Items>
          <AddressFields field={form.root.at("billing")} title="Billing" />
          <AddressFields field={form.root.at("shipping")} title="Shipping" />
          <SignupSummary />
          <For each={disabledErrors()}>{(entry) => <p>{entry.name}</p>}</For>
          <SubmitButton label="Save" />
          <button type="button" onClick={() => void owner.submit("publish")}>
            Publish
          </button>
        </form>
      )}
    </form.Form>
  );
}

// A fieldset generic in the value, so it takes handles of wider objects too.
function AnyAddressFields<A extends Address>(props: { field: HandleOf<typeof AddressShape, A>; title: string }) {
  const scope = AddressShape.scope(props.field);
  // A child that A's constraint names reads as the constraint's type.
  // (A plain assignment: expectTypeOf can't check a type that depends on A.)
  const street: NamedLeafHandle<string> = props.field.at("street");
  void street;
  return (
    <fieldset>
      <legend>{props.title}</legend>
      <scope.TextField name="street" label="Street" />
      <scope.TextField handle={props.field.at("city")} label="City" />
      <scope.Field name="zip">{(field) => <input {...inputProps(field)} />}</scope.Field>
      <scope.Field name="geo.lat">{(field) => <span>{field.value}</span>}</scope.Field>
      {/* @ts-expect-error: A's geo may be wider than Geo, so it needs a generic fieldset too */}
      <GeoFields field={props.field.at("geo")} />
    </fieldset>
  );
}

// A second form with a wider object that only the generic fieldset fits.
interface Office extends Address {
  phone: string;
}
const officeDefaults: { office: Office; label: string } = {
  office: { street: "", city: "", zip: "", geo: { lat: undefined, lng: undefined }, phone: "" },
  label: "",
};
const Company = forms.define({ defaultValues: officeDefaults });

function CompanyPage() {
  const form = createForm(Company);
  return (
    <form.Form>
      <AnyAddressFields field={form.root.at("office")} title="Office" />
      {/* @ts-expect-error: an office has a phone the address fieldset would drop on a write */}
      <AddressFields field={form.root.at("office")} title="Office" />
      <SubmitButton label="Save" />
    </form.Form>
  );
}

// A separate form whose Form sits inside another form's Form.
const RowDialog = forms.define({ defaultValues: { title: "" } });
function NestedForms() {
  const outer = createForm(Signup);
  const inner = createForm(RowDialog);
  return (
    <outer.Form>
      <inner.Form>
        {/* useFormContext() here is `inner`; useFormContext(Signup) still finds `outer`. */}
        <SignupSummary />
        <SubmitButton label="Save row" />
      </inner.Form>
    </outer.Form>
  );
}

describe("the form object", () => {
  it("carries V, E, I and R from the definition with no annotations", () => {
    const form = createForm(Signup);
    expectTypeOf(form).toEqualTypeOf<SignupForm>();
    expectTypeOf(form.store).toEqualTypeOf<FormStore<SignupDraft, FormError, Intent, SignupResult, {}, "valibot" | "arrays">>();
    expectTypeOf(form.root).toEqualTypeOf<NamedObjectHandle<SignupDraft, FormError, "valibot" | "arrays">>();
    expectTypeOf(form.id).toBeString();
    expectTypeOf(form.submit("save")).toEqualTypeOf<Promise<Submission<Intent, SignupResult>>>();
    expectTypeOf(form.handleSubmit()).toEqualTypeOf<Promise<void>>();
    expectTypeOf(createForm(Signup, { id: "signup", focusOnInvalid: false })).toEqualTypeOf<SignupForm>();
    // The core store still comes from createStore, for use outside components.
    expectTypeOf(Signup.createStore()).toEqualTypeOf(form.store);
  });

  it("reads the form snapshot through state", () => {
    const form = createForm(Signup);
    expectTypeOf(form.state).toEqualTypeOf<FormState<Intent, SignupResult>>();
    expectTypeOf(form.state.submitting).toEqualTypeOf<boolean>();
    const submission = form.state.submission;
    if (submission.status === "succeeded") expectTypeOf(submission.result).toEqualTypeOf<SignupResult>();
    // @ts-expect-error: state is read-only
    form.state.submitting = true;
  });

  it("narrows the submission inside Show and Match with no helper", () => {
    const form = createForm(Signup);
    void (
      <Show when={form.state.submission.status === "succeeded" && form.state.submission}>
        {(submission) => {
          expectTypeOf(submission().result).toEqualTypeOf<SignupResult>();
          return <p>{submission().result.id}</p>;
        }}
      </Show>
    );
    void (
      <Switch>
        <Match when={form.state.submission.status === "submitting" && form.state.submission}>
          {(submission) => {
            expectTypeOf(submission().intent).toEqualTypeOf<Intent>();
            return null;
          }}
        </Match>
      </Switch>
    );
    // The same narrowing holds in a plain expression.
    void (<p>{form.state.submission.status === "succeeded" && form.state.submission.result.id}</p>);
    // @ts-expect-error: without the status check there is no result
    void form.state.submission.result;
  });

  it("passes per-store options through the function form", () => {
    const Lines = forms.define((count: number) => ({
      schema: v.object({ rows: v.array(v.object({ title: v.string() })) }),
      defaultValues: { rows: Array.from({ length: count }, () => ({ title: "" })) },
    }));
    expectTypeOf(createForm(Lines, 3, { id: "lines" }).root.at("rows")).toEqualTypeOf<NamedArrayHandle<{ title: string }[], FormError, "valibot" | "arrays">>();
    // @ts-expect-error: the function form needs its options
    createForm(Lines);
  });

  it("requires an intent when undefined is not one", () => {
    const Post = forms.define({
      defaultValues: { title: "" },
      onSubmit: (_value, ctx: { intent: "draft" | "publish" }) => ctx.intent.length,
    });
    const form = createForm(Post);
    expectTypeOf(form.submit("draft")).toEqualTypeOf<Promise<Submission<"draft" | "publish", number>>>();
    // @ts-expect-error: the intent is required
    void form.submit();
    // @ts-expect-error: "archive" is not an intent
    void form.submit("archive");
  });

  it("type-checks Form with a function child and with plain children", () => {
    type RenderArgs = Parameters<Extract<Parameters<SignupForm["Form"]>[0]["children"], (...args: never[]) => unknown>>;
    expectTypeOf<RenderArgs[0]>().toEqualTypeOf<SignupForm["formProps"]>();
    expectTypeOf<RenderArgs[1]>().toEqualTypeOf<SignupForm>();
    // The first argument spreads onto a form element as it is, checked against Solid's form element props.
    const formProps: RenderArgs[0] = createForm(Signup).formProps;
    void (<form {...formProps} />);
    expectTypeOf(SignupPage).toBeFunction();
    expectTypeOf(CompanyPage).toBeFunction();
    expectTypeOf(NestedForms).toBeFunction();
  });
});

describe("Field", () => {
  it("resolves a name to its FieldApi", () => {
    const form = createForm(Signup);
    void (
      <form.Field name="billing.geo.lat">
        {(field) => {
          expectTypeOf(field).toEqualTypeOf<ExactFieldApi<number | undefined, FormError, "valibot" | "arrays">>();
          expectTypeOf(field.handle).toEqualTypeOf<NamedLeafHandle<number | undefined, FormError, "valibot" | "arrays">>();
          expectTypeOf(field.setValue).parameter(0).toEqualTypeOf<number | undefined | ((previous: number | undefined) => number | undefined)>();
          expectTypeOf(field.errorId).toBeString();
          return <span>{field.value}</span>;
        }}
      </form.Field>
    );
    void (
      <form.Field name="rows">
        {(field) => {
          expectTypeOf(field.keys).toEqualTypeOf<readonly string[]>();
          expectTypeOf(field.push).toBeFunction();
          return null;
        }}
      </form.Field>
    );
    void (
      <form.Field name="billing">
        {(field) => {
          expectTypeOf(field.at("city")).toEqualTypeOf<NamedLeafHandle<string, FormError, "valibot" | "arrays">>();
          return null;
        }}
      </form.Field>
    );
  });

  it("resolves a handle and takes a validator typed by the field", () => {
    const form = createForm(Signup);
    const qty = form.root.at("rows").item("k").at("qty");
    void (
      <form.Field handle={qty} validate={(value) => (value === undefined ? { message: "Required" } : null)}>
        {(field) => {
          expectTypeOf(field.value).toEqualTypeOf<number | undefined>();
          return <input {...numberProps(field)} />;
        }}
      </form.Field>
    );
    // @ts-expect-error: a string schema doesn't fit a number field
    void (<form.Field handle={qty} validate={v.string()}>{() => null}</form.Field>);
  });

  it("rejects a wrong name, an index, both name and handle, or neither", () => {
    const form = createForm(Signup);
    expectTypeOf<FieldPath<SignupDraft>>().toExtend<string>();
    // @ts-expect-error: no such field
    void (<form.Field name="billing.country">{() => null}</form.Field>);
    // @ts-expect-error: names have no array indexes
    void (<form.Field name="rows.0.title">{() => null}</form.Field>);
    // @ts-expect-error: names stop at an array
    void (<form.Field name="rows.title">{() => null}</form.Field>);
    // @ts-expect-error: name and handle together
    void (<form.Field name="name" handle={form.root.at("name")}>{() => null}</form.Field>);
    // @ts-expect-error: neither name nor handle
    void (<form.Field>{() => null}</form.Field>);
  });

  it("names fields up to PathMaxDepth segments", () => {
    type Deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: string } } } } } } } } };
    expectTypeOf<PathMaxDepth>().toEqualTypeOf<8>();
    expectTypeOf<"a.b.c.d.e.f.g.h">().toExtend<FieldPath<Deep>>();
    expectTypeOf<"a.b.c.d.e.f.g.h.i">().not.toExtend<FieldPath<Deep>>();
  });

  it("checks the props functions on the field", () => {
    const form = createForm(Signup);
    void (
      <form.Field name="plan">
        {(field) => {
          expectTypeOf(selectProps(field)).toEqualTypeOf<SelectProps>();
          expectTypeOf(radioProps(field, "pro")).toEqualTypeOf<RadioInputProps>();
          // @ts-expect-error: a plan is not a number
          numberProps(field);
          // @ts-expect-error: "team" is not a plan
          radioProps(field, "team");
          return null;
        }}
      </form.Field>
    );
  });
});

describe("Items", () => {
  it("renders item handles keyed by stable keys", () => {
    const form = createForm(Signup);
    void (
      <Items handle={form.root.at("rows")}>
        {(row, index) => {
          expectTypeOf(row).toEqualTypeOf<NamedItemHandle<Row, FormError, "valibot" | "arrays">>();
          expectTypeOf(index).toEqualTypeOf<Accessor<number>>();
          return <form.Field handle={row.at("qty")}>{(field) => <span>{field.value}</span>}</form.Field>;
        }}
      </Items>
    );
    void (
      <Items handle={form.root.at("tags")}>
        {(tag) => {
          expectTypeOf(tag).toEqualTypeOf<NamedItemHandle<string, FormError, "valibot" | "arrays">>();
          return <form.TextField handle={tag} label="Tag" />;
        }}
      </Items>
    );
  });

  it("rejects a handle that is not an array", () => {
    const form = createForm(Signup);
    expectTypeOf(form.root.at("name")).not.toHaveProperty("item");
    // @ts-expect-error: a leaf handle has no items
    void (<Items handle={form.root.at("name")}>{() => null}</Items>);
  });

  it("needs arrays()", () => {
    const form = createForm(exactForms.define({ defaultValues: { tags: ["a"] } }));
    expectTypeOf(form.root.at("tags")).toEqualTypeOf<NamedArrayHandle<string[]>>();
    // @ts-expect-error: Add arrays() to this form's plugins
    void (<Items handle={form.root.at("tags")}>{() => null}</Items>);
    // @ts-expect-error: Add arrays() to this form's plugins
    createItems(form.root.at("tags"));
  });
});

// Registered components that declare a validate prop of their own, which the bound component reserves.
function OwnValidate(props: { field: FieldApi<string>; validate: boolean }) {
  return <input {...inputProps(props.field)} data-validate={props.validate} />;
}
function OptionalValidate(props: { field: FieldApi<string>; validate?: () => void }) {
  return <input {...inputProps(props.field)} onBlur={props.validate} />;
}

describe("registered field components", () => {
  it("are bound on the form by name and by handle", () => {
    const form = createForm(Signup);
    expectTypeOf(form.TextField).toBeFunction();
    void (<form.TextField name="billing.street" label="Street" />);
    void (<form.TextField handle={form.root.at("bio")} label="Bio" placeholder="About you" />);
    void (<form.NumberField name="age" label="Age" />);
  });

  it("require their own props and reject fields of the wrong type", () => {
    const form = createForm(Signup);
    expectTypeOf(form.NumberField).toBeFunction();
    // @ts-expect-error: label is required
    void (<form.TextField name="name" />);
    // @ts-expect-error: a string field doesn't fit NumberField
    void (<form.NumberField name="name" label="Name" />);
    // @ts-expect-error: a number field doesn't fit TextField
    void (<form.TextField handle={form.root.at("age")} label="Age" />);
    // @ts-expect-error: the field prop is filled in by the adapter
    void (<form.TextField name="name" label="Name" field={createField(form.root.at("name"))} />);
  });

  it("takes a Draft<T> field exactly and a plain T field loosely", () => {
    const plainDefaults: { count: number; maybe: number | undefined; label: string; flag: number | null } = {
      count: 0,
      maybe: 0,
      label: "",
      flag: 0,
    };
    const Plain = forms.define({ defaultValues: plainDefaults });
    const form = createForm(Plain);
    expectTypeOf(form.root.at("count")).toEqualTypeOf<NamedLeafHandle<number, FormError, "valibot" | "arrays">>();
    // FieldApi<number> is the field of a Draft<number>, number | undefined.
    expectTypeOf<FieldApi<number>["value"]>().toEqualTypeOf<number | undefined>();
    expectTypeOf<FieldApi<number>["setValue"]>().parameter(0).toEqualTypeOf<number | undefined | ((previous: number | undefined) => number | undefined)>();
    expectTypeOf<FieldApi<string>["value"]>().toEqualTypeOf<string>();
    // A plain number field fits too. This side is loose: NumberField may write undefined into it.
    void (<form.NumberField name="count" label="Count" />);
    void (<form.NumberField name="maybe" label="Maybe" />);
    void (<form.NumberField handle={form.root.at("count")} label="Count" />);
    // @ts-expect-error: a string field doesn't fit NumberField
    void (<form.NumberField name="label" label="Label" />);
    // @ts-expect-error: number | null is neither number nor Draft<number>
    void (<form.NumberField name="flag" label="Flag" />);
  });

  it("takes an exact field object component only for that exact type", () => {
    const counts: { count: number; maybe: number | undefined } = { count: 0, maybe: 0 };
    const form = createForm(exactForms.define({ defaultValues: counts }));
    expectTypeOf(form.ExactCount).toBeFunction();
    void (<form.ExactCount name="count" label="Count" />);
    // @ts-expect-error: an exact component doesn't take the Draft
    void (<form.ExactCount name="maybe" label="Maybe" />);
  });

  it("rejects a registration that collides with the form's own members, or has no field prop", () => {
    expectTypeOf(createForms).toBeFunction();
    // @ts-expect-error: Field is the form's own
    createForms({ fields: { Field: TextField } });
    // @ts-expect-error: submit is the form's own
    createForms({ fields: { submit: TextField } });
    // @ts-expect-error: a field component takes a field prop
    createForms({ fields: { Label: (props: { text: string }) => <span>{props.text}</span> } });
  });

  it("take a validate prop typed by the field, by name, by handle and on a scope", () => {
    const form = createForm(Signup);
    const billing = AddressShape.scope(form.root.at("billing"));
    const qty = form.root.at("rows").item("k").at("qty");
    void (
      <form.TextField
        name="name"
        label="Name"
        validate={(value) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return value.endsWith("@x.io") ? undefined : { message: "Use your work email." };
        }}
      />
    );
    void (
      <form.NumberField
        handle={qty}
        label="Qty"
        validate={(value) => {
          expectTypeOf(value).toEqualTypeOf<number | undefined>();
          return null;
        }}
      />
    );
    void (<form.NumberField name="age" label="Age" validate={debounced((value) => (value === undefined ? { message: "Required" } : null), 300)} />);
    void (<form.Field name="age" validate={debounced((value) => (expectTypeOf(value).toEqualTypeOf<number | undefined>(), null), 300)}>{() => null}</form.Field>);
    void (<form.Field name="name" validate={false}>{() => null}</form.Field>);
    void (<billing.TextField name="city" label="City" validate={(value) => (expectTypeOf(value).toEqualTypeOf<string>(), null)} />);
    void (<billing.Field name="geo.lat" validate={(value) => (expectTypeOf(value).toEqualTypeOf<number | undefined>(), null)}>{() => null}</billing.Field>);
    // @ts-expect-error: name is a string, not a number
    void (<form.TextField name="name" label="Name" validate={(value: number) => (value > 0 ? null : { message: "No" })} />);
    // @ts-expect-error: qty is number | undefined, the validator takes number only
    void (<form.NumberField handle={qty} label="Qty" validate={(value: number) => (value > 0 ? null : { message: "No" })} />);
    // @ts-expect-error: age is number | undefined, the validator takes string
    void (<form.Field name="age" validate={(value: string) => (value === "" ? null : { message: "No" })}>{() => null}</form.Field>);
    // @ts-expect-error: a string schema doesn't fit a number field
    void (<form.NumberField name="age" label="Age" validate={v.string()} />);
    // @ts-expect-error: city is a string
    void (<billing.TextField name="city" label="City" validate={(value: number) => (value > 0 ? null : { message: "No" })} />);
  });

  it("reject a registered component that declares its own validate prop", () => {
    expectTypeOf(OwnValidate).toBeFunction();
    // @ts-expect-error: validate is the bound component's own prop
    createForms({ fields: { OwnValidate } });
    // @ts-expect-error: an optional validate prop collides too
    createForms({ fields: { TextField, OptionalValidate } });
  });

  it("check the error type too", () => {
    interface AppError {
      readonly code: string;
    }
    const appForms = createForms({ mapError: (raw): AppError => ({ code: raw.message }), fields: { TextField } });
    const form = createForm(appForms.define({ defaultValues: { handle: "" } }));
    expectTypeOf(form.root).toEqualTypeOf<NamedObjectHandle<{ handle: string }, AppError>>();
    // @ts-expect-error: TextField renders FormError messages, and this form's errors are AppError
    void (<form.TextField name="handle" label="Handle" />);
  });
});

describe("scopes and fieldsets", () => {
  it("makes a scope for any object handle, with names relative to it", () => {
    const form = createForm(Signup);
    const billing = forms.scope(form.root.at("billing"));
    expectTypeOf(billing).toEqualTypeOf<Scope<Address, FormError, Fields, "valibot" | "arrays">>();
    void (<billing.TextField name="city" label="City" />);
    void (<billing.Field name="geo.lng">{(field) => <span>{field.value}</span>}</billing.Field>);
    // @ts-expect-error: names are relative to the scope
    void (<billing.TextField name="billing.city" label="City" />);
    const row = forms.scope(form.root.at("rows").item("k"));
    expectTypeOf(row.root).toEqualTypeOf<NamedObjectHandle<Row, FormError, "valibot" | "arrays">>();
  });

  it("types the fieldset prop from the shape", () => {
    expectTypeOf<HandleOf<typeof AddressShape>>().toEqualTypeOf<NamedFieldHandle<Address>>();
    expectTypeOf<HandleOf<typeof GeoShape>>().toEqualTypeOf<NamedFieldHandle<Geo>>();
    // A fieldset types the scope, with the shared plugins: `scope` takes the handle and nothing else.
    expectTypeOf<Parameters<typeof AddressShape.scope>>().toEqualTypeOf<[handle: HandleBase<Address>]>();
    expectTypeOf<ReturnType<typeof AddressShape.scope<NamedFieldHandle<Address>>>>().toEqualTypeOf<Scope<Address, FormError, Fields, "valibot" | "arrays">>();
  });

  it("takes handles of the shape at any path, in rows and in other forms", () => {
    expectTypeOf(AddressFields).toBeFunction();
    expectTypeOf(GeoFields).toBeFunction();
  });

  it("rejects a handle of the wrong shape", () => {
    const form = createForm(Signup);
    expectTypeOf(form.root.at("billing").at("geo")).toEqualTypeOf<NamedObjectHandle<Geo, FormError, "valibot" | "arrays">>();
    // @ts-expect-error: a geo object is not an address
    void (<AddressFields field={form.root.at("billing").at("geo")} title="Geo" />);
    // @ts-expect-error: rows is an array
    void (<AddressFields field={form.root.at("rows")} title="Rows" />);
    // @ts-expect-error: the fieldset's own props are required
    void (<AddressFields field={form.root.at("billing")} />);
    const loose: { geo: { lat: number; lng: number } } = { geo: { lat: 0, lng: 0 } };
    const other = createForm(forms.define({ defaultValues: loose }));
    // @ts-expect-error: lat is number here, and the shape's lat is number | undefined
    void (<GeoFields field={other.root.at("geo")} />);
  });
});

// Reusable parts for any form. They read the nearest form with no definition and need no cast.
function GenericSubmit() {
  const form = useFormContext();
  return (
    <form {...form.formProps} onSubmit={(event) => void form.handleSubmit(event)}>
      <button type="submit" disabled={form.state.submitting} onClick={() => void form.submit()}>
        Save
      </button>
    </form>
  );
}

function GenericReset() {
  const form = useFormContext();
  // @ts-expect-error: a form of unknown plugins may have no dirty()
  void form.state.dirty;
  return (
    <button type="button" disabled={form.state.submitCount === 0} onClick={() => form.store.reset()}>
      Reset
    </button>
  );
}

function GenericStatus() {
  const form = useFormContext();
  const disabled = createDisabledErrors(form);
  const { state } = form;
  expectTypeOf(state.submission.status).toEqualTypeOf<"idle" | "submitting" | "invalid" | "succeeded" | "failed">();
  return (
    <p>
      {[state.valid, state.validating, state.submitting, state.submitCount, disabled().length].join(" ")}
    </p>
  );
}

describe("context", () => {
  it("types createForm and useFormContext from the definition", () => {
    expectTypeOf(useFormContext(Signup)).toEqualTypeOf<SignupForm>();
    expectTypeOf<FormOf<typeof Signup>>().toEqualTypeOf<SignupForm>();
    const Seeded = forms.define((title: string) => ({ defaultValues: { title } }));
    expectTypeOf(useFormContext(Seeded)).toEqualTypeOf<FormOf<typeof Seeded>>();
    expectTypeOf(createForm(Seeded, "a").root).toEqualTypeOf<NamedObjectHandle<{ title: string }, FormError, "valibot" | "arrays">>();
    // @ts-expect-error: the options have the wrong type
    createForm(Seeded, 1);
    // @ts-expect-error: a definition from a plain config takes no options
    createForm(Signup, "a", { id: "signup" });
    // @ts-expect-error: a form is not a definition
    useFormContext(createForm(Signup));
  });

  it("gives a generic submit button, reset button and status line all they need with no cast", () => {
    expectTypeOf(GenericSubmit).toBeFunction();
    expectTypeOf(GenericReset).toBeFunction();
    expectTypeOf(GenericStatus).toBeFunction();
  });

  it("reads the nearest form untyped, or its own definition's form typed", () => {
    expectTypeOf(SubmitButton).toBeFunction();
    expectTypeOf(SignupSummary).toBeFunction();
    const form = useFormContext();
    expectTypeOf(form.state.submitting).toEqualTypeOf<boolean>();
    expectTypeOf(form.formProps.novalidate).toEqualTypeOf<true>();
    expectTypeOf(form.submit).parameters.toEqualTypeOf<[intent?: unknown]>();
  });
});

describe("free functions", () => {
  it("work on handles with no form object or context", () => {
    const form = createForm(Signup);
    const name = createField(form.root.at("name"));
    expectTypeOf(name).toEqualTypeOf<ExactFieldApi<string, FormError, "valibot" | "arrays">>();
    expectTypeOf(createItems(form.root.at("rows"))).toEqualTypeOf<Accessor<readonly NamedItemHandle<Row, FormError, "valibot" | "arrays">[]>>();
    expectTypeOf(createValidator(form.root.at("age"), (value) => (value === undefined ? { message: "Required" } : null))).toBeVoid();
    expectTypeOf(errorId(form.root.at("name"))).toBeString();
    expectTypeOf(fieldRef(form.root.at("name"))).toEqualTypeOf<(element: HTMLElement) => void>();
    expectTypeOf(createDisabledErrors(form.store)).toEqualTypeOf<Accessor<readonly DisabledInvalid[]>>();
    // @ts-expect-error: createItems takes an array handle
    createItems(form.root.at("name"));
  });

  it("types each props function and rejects fields it doesn't fit", () => {
    const root = createForm(Signup).root;
    expectTypeOf(inputProps(createField(root.at("name")))).toEqualTypeOf<TextInputProps>();
    expectTypeOf(inputProps(createField(root.at("name")), { type: "email", describedBy: "hint" })).toEqualTypeOf<TextInputProps>();
    expectTypeOf(textareaProps(createField(root.at("bio")))).toEqualTypeOf<TextareaProps>();
    expectTypeOf(numberProps(createField(root.at("age")))).toEqualTypeOf<NumberInputProps>();
    expectTypeOf(rangeProps(createField(root.at("age")))).toEqualTypeOf<RangeInputProps>();
    expectTypeOf(checkboxProps(createField(root.at("subscribe")))).toEqualTypeOf<CheckboxInputProps>();
    expectTypeOf(checkboxGroupProps(createField(root.at("tags")), "news")).toEqualTypeOf<CheckboxGroupInputProps>();
    expectTypeOf(checkboxGroupProps(createField(root.at("channels")), "sms")).toEqualTypeOf<CheckboxGroupInputProps>();
    expectTypeOf(radioProps(createField(root.at("plan")), "pro", { describedBy: "hint" })).toEqualTypeOf<RadioInputProps>();
    expectTypeOf(selectProps(createField(root.at("plan")))).toEqualTypeOf<SelectProps>();
    // @ts-expect-error: a number field is not text
    inputProps(createField(root.at("age")));
    // @ts-expect-error: a string field is not a number input
    numberProps(createField(root.at("name")));
    // @ts-expect-error: a checkbox group's value is one of the array's items
    checkboxGroupProps(createField(root.at("tags")), 1);
    // @ts-expect-error: a picked option is never undefined
    checkboxGroupProps(createField(root.at("channels")), undefined);
    // @ts-expect-error: a boolean field is not a select
    selectProps(createField(root.at("subscribe")));
  });

  it("spreads input props onto their elements", () => {
    const root = createForm(Signup).root;
    void (
      <>
        <textarea {...textareaProps(createField(root.at("bio")))} />
        <input {...checkboxProps(createField(root.at("subscribe")))} />
        <select {...selectProps(createField(root.at("plan")))} />
        <div ref={fieldRef(root.at("billing").at("zip"))} tabindex={0} />
      </>
    );
    expectTypeOf(root).toEqualTypeOf<NamedObjectHandle<SignupDraft, FormError, "valibot" | "arrays">>();
  });
});

function Checkbox(props: { field: FieldApi<boolean>; label: string }) {
  return (
    <label>
      <input {...checkboxProps(props.field)} />
      {props.label}
    </label>
  );
}

interface Pickup {
  pickup: boolean;
  note: string;
}

const checkboxForms = createForms({ fields: { Checkbox, TextField } });
const PickupOrder = checkboxForms.define({ defaultValues: { pickup: false, note: "" } satisfies Pickup });
const PickupConst = checkboxForms.define({ defaultValues: { pickup: false, note: "" } as const });

function PickupFields() {
  const satisfied = createForm(PickupOrder);
  const constant = createForm(PickupConst);
  return (
    <>
      <satisfied.Checkbox name="pickup" label="Pickup" />
      <satisfied.TextField name="note" label="Note" />
      <constant.Checkbox name="pickup" label="Pickup" />
    </>
  );
}

describe("literals in defaultValues", () => {
  it("widens false from satisfies or as const, so a FieldApi<boolean> component fits", () => {
    expectTypeOf(PickupFields).toBeFunction();
    expectTypeOf(createForm(PickupOrder).root.at("pickup")).toEqualTypeOf<NamedLeafHandle<boolean>>();
  });
});

interface TreeNode {
  name: string;
  children: TreeNode[];
}

const treeForm = createForms({ plugins: [arrays()] }).define<TreeNode>({ defaultValues: { name: "root", children: [] } });

describe("recursive value types", () => {
  it("defines a form whose value holds itself", () => {
    expectTypeOf(createForm(treeForm).root.at("name")).toEqualTypeOf<NamedLeafHandle<string, FormError, "arrays">>();
    createForm(treeForm).root.at("children").push({ name: "leaf", children: [] });
  });
});

function TagsField(props: { field: FieldApi<string[]> }) {
  props.field.setValue(props.field.value);
  return null;
}

describe("writing back a value read from a field", () => {
  it("takes the readonly values the field object holds", () => {
    const form = createForm(Signup);
    const billing = createField(form.root.at("billing"));
    billing.setValue(billing.value, { replace: true });
    billing.setValue({ geo: billing.value.geo });
    // @ts-expect-error: an address has no country
    billing.setValue({ country: "FR" });
    // @ts-expect-error: city is a string
    billing.setValue({ city: 1 });

    const rows = createField(form.root.at("rows"));
    rows.setValue(rows.value);
    const [first] = rows.value;
    if (first) {
      rows.push(first);
      rows.insert(0, first);
    }
    // @ts-expect-error: a row has no note
    rows.push({ title: "", qty: 1, address: first?.address ?? billing.value, note: "" });
    // @ts-expect-error: title is a string
    rows.push({ title: 1, qty: 1, address: billing.value });

    const tags = createField(form.root.at("tags"));
    tags.setValue(tags.value);
    expectTypeOf(tags.value).toExtend<Parameters<typeof tags.setValue>[0]>();
    void (
      <form.Field name="channels">
        {(field) => {
          field.setValue(field.value);
          return null;
        }}
      </form.Field>
    );
  });

  it("works through a registered component's FieldApi", () => {
    expectTypeOf(TagsField).toBeFunction();
  });
});
