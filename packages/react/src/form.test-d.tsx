import { describe, expectTypeOf, it } from "vitest";
import type { ComponentProps } from "react";
import {
  createForms,
  type FieldApi,
  type FieldHandle,
  type FormError,
  type FormInstance,
  type FormOf,
  type FormSnapshot,
  type FormStateComponent,
  type FormStore,
  type HandleOf,
  type ItemHandle,
  type LeafHandle,
  type ObjectHandle,
  type Fieldset,
  type ReactFormDefinition,
  type SchemaPlugin,
  type StandardSchemaV1,
  type Submission,
  type UnknownForm,
  useDisabledErrors,
  useForm,
  useFormContext,
  useFormState,
} from "./index.js";

// A schema type a schema plugin accepts, as in core's type tests. No schema library is needed.
interface FakeSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly fake: true;
}
declare const fakePlugin: SchemaPlugin<FakeSchema<unknown>>;

// The app's own field components, registered once in createForms.
function TextField(props: { readonly field: FieldApi<string>; readonly label: string; readonly placeholder?: string }) {
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps()} placeholder={props.placeholder} />
      {props.field.shownErrors.length > 0 && <p id={props.field.errorId}>{props.field.shownErrors[0]?.message}</p>}
    </label>
  );
}

function NumberField(props: { readonly field: FieldApi<number>; readonly label: string }) {
  expectTypeOf(props.field.value).toEqualTypeOf<number | undefined>();
  expectTypeOf<number | undefined>().toExtend<Parameters<typeof props.field.setValue>[0]>();
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps({ kind: "number" })} />
    </label>
  );
}

const forms = createForms({ plugins: [fakePlugin], fields: { TextField, NumberField } });

interface Address {
  street: string;
  city: string;
  zip: string;
  geo: { lat: number; lng: number };
}
interface Order {
  customer: string;
  email: string;
  age: number;
  billing: Address;
  shipping: Address;
  lines: { item: string; qty: number }[];
  stops: Address[];
  channels: ("email" | "sms")[];
}
declare const orderSchema: FakeSchema<Order>;
declare const addressSchema: FakeSchema<Address>;

// Address and Order as the adapter's defaults leave them: numbers start undefined.
interface DraftAddress {
  street: string;
  city: string;
  zip: string;
  geo: { lat: number | undefined; lng: number | undefined };
}
type DraftLine = { item: string; qty: number | undefined };

const order = forms.define({
  schema: orderSchema,
  onSubmit: (value, ctx: { intent: "save" | "send" | undefined }) => {
    expectTypeOf(value).toEqualTypeOf<Order>();
    return { id: String(ctx.intent) };
  },
});

type DraftOrder = {
  customer: string;
  email: string;
  age: number | undefined;
  billing: DraftAddress;
  shipping: DraftAddress;
  lines: DraftLine[];
  stops: DraftAddress[];
  channels: ("email" | "sms")[];
};
type Fields = { readonly TextField: typeof TextField; readonly NumberField: typeof NumberField };
type Installed = readonly [typeof fakePlugin];
type OrderForm = FormInstance<DraftOrder, FormError, "save" | "send" | undefined, { id: string }, Fields, Installed>;

function OrderPage() {
  const form = useForm(order);
  expectTypeOf(form).toEqualTypeOf<OrderForm>();
  expectTypeOf(form.root).toEqualTypeOf<ObjectHandle<DraftOrder>>();
  expectTypeOf(form.store).toEqualTypeOf<FormStore<DraftOrder, FormError, "save" | "send" | undefined, { id: string }>>();
  expectTypeOf(form.submit("send")).toEqualTypeOf<Promise<Submission<"save" | "send" | undefined, { id: string }>>>();
  // @ts-expect-error: not one of the intents
  void form.submit("delete");

  return (
    <form.Form>
      {(props, owner) => (
        <form {...props}>
          <form.TextField name="customer" label="Customer" placeholder="Name" />
          <form.TextField name="billing.city" label="City" />
          <form.NumberField name="age" label="Age" />
          <form.Field name="email">
            {(field) => {
              expectTypeOf(field.value).toEqualTypeOf<string>();
              expectTypeOf(field.handle).toEqualTypeOf<LeafHandle<string>>();
              return <input {...field.inputProps({ type: "email" })} />;
            }}
          </form.Field>
          <form.Field name="channels">
            {(field) => {
              expectTypeOf(field.value).toEqualTypeOf<readonly ("email" | "sms")[]>();
              // @ts-expect-error: a picked option is never undefined
              field.inputProps({ kind: "checkbox", value: undefined });
              return <input {...field.inputProps({ kind: "checkbox", value: "sms" })} />;
            }}
          </form.Field>
          <form.Items name="lines">
            {(line) => {
              expectTypeOf(line).toEqualTypeOf<ItemHandle<DraftLine>>();
              return <Line line={line} />;
            }}
          </form.Items>
          <SubmitButton />
          <button type="button" onClick={() => void owner.submit("send")}>
            Send
          </button>
        </form>
      )}
    </form.Form>
  );
}

// Fields given by handle, here an item handle passed as a prop with no provider.
function Line({ line }: { readonly line: ItemHandle<DraftLine> }) {
  const form = useFormContext(order);
  return (
    <>
      <form.TextField handle={line.at("item")} label="Item" />
      <form.NumberField handle={line.at("qty")} label="Qty" />
      <form.Field handle={line.at("qty")} select={(snapshot) => snapshot.shownErrors.length}>
        {(count, handle) => {
          expectTypeOf(count).toEqualTypeOf<number>();
          expectTypeOf(handle).toEqualTypeOf<LeafHandle<number | undefined>>();
          return <span>{count}</span>;
        }}
      </form.Field>
      <button type="button" onClick={() => form.root.at("lines").remove(0)}>
        Remove
      </button>
    </>
  );
}

// A reusable button for any form, through the generic reader.
function SubmitButton() {
  const form = useFormContext();
  const submitting = useFormState(form, (snapshot) => snapshot.submitting);
  return (
    <button type="submit" disabled={submitting}>
      Save
    </button>
  );
}

function WrongUsage() {
  const form = useForm(order);
  const line = form.root.at("lines").item("k");
  return (
    <>
      {/* @ts-expect-error: no such field */}
      <form.Field name="billing.country">{() => null}</form.Field>
      {/* @ts-expect-error: names go through objects only, so an index is not a name */}
      <form.Field name="lines.0.item">{() => null}</form.Field>
      {/* @ts-expect-error: both name and handle */}
      <form.Field name="email" handle={line.at("item")}>{() => null}</form.Field>
      {/* @ts-expect-error: neither name nor handle */}
      <form.Field>{() => null}</form.Field>
      {/* @ts-expect-error: billing is not an array */}
      <form.Items name="billing">{() => null}</form.Items>
      {/* @ts-expect-error: the component's own label prop is required */}
      <form.TextField name="customer" />
      {/* @ts-expect-error: customer is a string, NumberField edits numbers */}
      <form.NumberField name="customer" label="Customer" />
      {/* @ts-expect-error: age is number | undefined, TextField edits string */}
      <form.TextField name="age" label="Age" />
      {/* @ts-expect-error: the item handle's value is a string */}
      <form.NumberField handle={line.at("item")} label="Item" />
      {/* @ts-expect-error: field is filled in by the form, not passed */}
      <form.TextField name="customer" label="Customer" field={undefined} />
    </>
  );
}

// The validate prop, typed from the field on Field, on bound components and on scope components.
function ValidateProps() {
  const form = useForm(order);
  const billing = AddressShape.scope(form.root.at("billing"));
  const qty = form.root.at("lines").item("k").at("qty");
  return (
    <>
      <form.TextField
        name="email"
        label="Email"
        validate={(value) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return value.endsWith("@x.io") ? undefined : { message: "Use your work email." };
        }}
      />
      <form.NumberField
        handle={qty}
        label="Qty"
        validate={(value) => {
          expectTypeOf(value).toEqualTypeOf<number | undefined>();
          return null;
        }}
      />
      <form.NumberField name="age" label="Age" validate={{ validate: (value) => (value === undefined ? { message: "Required" } : null), debounce: 300 }} />
      <form.Field name="age" validate={{ validate: (value: number | undefined) => (value === 0 ? { message: "Zero" } : null), debounce: 300 }}>
        {(field) => <input {...field.inputProps({ kind: "number" })} />}
      </form.Field>
      <form.Field handle={qty} validate={(value) => (expectTypeOf(value).toEqualTypeOf<number | undefined>(), null)}>
        {(field) => <input {...field.inputProps({ kind: "number" })} />}
      </form.Field>
      <form.Field name="email" validate={false}>{() => null}</form.Field>
      <billing.TextField
        name="city"
        label="City"
        validate={(value) => {
          expectTypeOf(value).toEqualTypeOf<string>();
          return null;
        }}
      />
      <billing.Field name="geo.lat" validate={(value) => (expectTypeOf(value).toEqualTypeOf<number | undefined>(), null)}>
        {() => null}
      </billing.Field>
      {/* @ts-expect-error: email is a string, not a number */}
      <form.TextField name="email" label="Email" validate={(value: number) => (value > 0 ? null : { message: "No" })} />
      {/* @ts-expect-error: qty is number | undefined, the validator takes number only */}
      <form.NumberField handle={qty} label="Qty" validate={(value: number) => (value > 0 ? null : { message: "No" })} />
      {/* @ts-expect-error: age is number | undefined, the validator takes string */}
      <form.Field name="age" validate={(value: string) => (value === "" ? null : { message: "No" })}>{() => null}</form.Field>
      {/* @ts-expect-error: a string schema doesn't fit a number field */}
      <form.Field handle={qty} validate={addressSchema}>{() => null}</form.Field>
      {/* @ts-expect-error: city is a string */}
      <billing.TextField name="city" label="City" validate={(value: number) => (value > 0 ? null : { message: "No" })} />
    </>
  );
}

// Registered components that declare a validate prop of their own, which the bound component reserves.
function OwnValidate(props: { readonly field: FieldApi<string>; readonly validate: boolean }) {
  return <input {...props.field.inputProps()} data-validate={props.validate} />;
}
function OptionalValidate(props: { readonly field: FieldApi<string>; readonly validate?: () => void }) {
  return <input {...props.field.inputProps()} onBlur={props.validate} />;
}

describe("createForms", () => {
  it("rejects field components that collide with form members, have no field prop or declare validate", () => {
    // @ts-expect-error: Field is the form's own member
    createForms({ fields: { Field: TextField } });
    // @ts-expect-error: submit is the form's own member
    createForms({ fields: { submit: TextField } });
    // @ts-expect-error: State is the form's own member
    createForms({ fields: { State: TextField } });
    // @ts-expect-error: a field component needs a field prop
    createForms({ fields: { Label: (props: { readonly text: string }) => <span>{props.text}</span> } });
    // @ts-expect-error: validate is the bound component's own prop
    createForms({ fields: { OwnValidate } });
    // @ts-expect-error: an optional validate prop collides too
    createForms({ fields: { TextField, OptionalValidate } });
    expectTypeOf(createForms({ fields: { TextField } })).toBeObject();
  });

  it("carries V, E, I, R and the fields from the definition", () => {
    expectTypeOf(order).toEqualTypeOf<
      ReactFormDefinition<DraftOrder, FormError, "save" | "send" | undefined, { id: string }, void, Fields, Installed>
    >();
  });
});

describe("the form object", () => {
  it("types useForm, Form, Field, Items and the registered components with no annotations", () => {
    expectTypeOf(OrderPage).toBeFunction();
    expectTypeOf(Line).toBeFunction();
    expectTypeOf(WrongUsage).toBeFunction();
    expectTypeOf(ValidateProps).toBeFunction();
  });

  it("gives form.Form's child the form element props, then the form", () => {
    type RenderArgs = Parameters<Extract<ComponentProps<OrderForm["Form"]>["children"], (...args: never[]) => unknown>>;
    expectTypeOf<RenderArgs[0]>().toExtend<ComponentProps<"form">>();
    expectTypeOf<RenderArgs[0]>().toEqualTypeOf<OrderForm["formProps"]>();
    expectTypeOf<RenderArgs[1]>().toEqualTypeOf<OrderForm>();
    expectTypeOf<Parameters<Extract<ComponentProps<UnknownForm["Form"]>["children"], (...args: never[]) => unknown>>[1]>().toEqualTypeOf<UnknownForm>();
  });

  it("reads the form state from the generic and the typed context", () => {
    expectTypeOf(SubmitButton).toBeFunction();
    expectTypeOf(useFormState<undefined, { id: string }>).returns.toEqualTypeOf<FormSnapshot<undefined, { id: string }>>();
  });
});

// Reusable fieldsets: a shape token and an ordinary component that asks for its scope.
const AddressShape = forms.fieldset(addressSchema);
const GeoShape = forms.fieldset<{ lat: number | undefined; lng: number | undefined }>();
const ContactShape = forms.fieldset<{ customer: string; email: string }>();

function GeoFields(props: { readonly field: HandleOf<typeof GeoShape> }) {
  const scope = GeoShape.scope(props.field);
  return (
    <>
      <scope.NumberField name="lat" label="Latitude" />
      <scope.NumberField name="lng" label="Longitude" />
    </>
  );
}

function AddressFields(props: { readonly field: HandleOf<typeof AddressShape>; readonly title: string }) {
  const scope = AddressShape.scope(props.field);
  expectTypeOf(scope.root).toEqualTypeOf<ObjectHandle<DraftAddress>>();
  return (
    <fieldset>
      <legend>{props.title}</legend>
      <scope.TextField name="street" label="Street" />
      <scope.TextField name="city" label="City" />
      <scope.Field name="zip">{(field) => <input {...field.inputProps()} />}</scope.Field>
      <GeoFields field={scope.root.at("geo")} />
      {/* @ts-expect-error: names are relative to the shape, which has no customer */}
      <scope.TextField name="customer" label="Customer" />
    </fieldset>
  );
}

function ContactFields(props: { readonly field: HandleOf<typeof ContactShape> }) {
  const scope = ContactShape.scope(props.field);
  return (
    <>
      <scope.TextField name="customer" label="Customer" />
      <scope.TextField name="email" label="Email" />
    </>
  );
}

declare const emptyHandle: HandleOf<typeof AddressShape>;

// A second form that uses the same fieldset.
const emptyAddress: DraftAddress = { street: "", city: "", zip: "", geo: { lat: undefined, lng: undefined } };
const profile = forms.define({ defaultValues: { home: emptyAddress } });

function ProfileForm() {
  const form = useForm(profile);
  return (
    <form.Form>
      <AddressFields field={form.root.at("home")} title="Home" />
    </form.Form>
  );
}

function OrderWithFieldsets() {
  const form = useForm(order);
  // A cached lookup, not a hook: the same handle gives the same scope and components.
  const billing = forms.scope(form.root.at("billing"));
  return (
    <form.Form>
      {(props) => (
        <form {...props}>
          <ContactFields field={form.root} />
          <AddressFields field={form.root.at("billing")} title="Billing" />
          <AddressFields field={form.root.at("shipping")} title="Shipping" />
          <billing.TextField name="zip" label="Billing zip" />
          <form.Items name="stops">{(stop) => <AddressFields field={stop} title="Stop" />}</form.Items>
          {/* @ts-expect-error: lines is an array, not an address */}
          <AddressFields field={form.root.at("lines")} title="Lines" />
          {/* @ts-expect-error: geo has numbers where an address has strings */}
          <AddressFields field={form.root.at("billing").at("geo")} title="Geo" />
          {/* @ts-expect-error: the fieldset's own title prop is required */}
          <AddressFields field={form.root.at("billing")} />
        </form>
      )}
    </form.Form>
  );
}

// A plain form whose number field has no undefined fits a FieldApi<number> component too.
const plainForm = forms.define({ defaultValues: { count: 0, title: "" } });

function PlainNumbers() {
  const form = useForm(plainForm);
  return (
    <>
      <form.NumberField name="count" label="Count" />
      <form.NumberField handle={form.root.at("count")} label="Count" />
      {/* @ts-expect-error: title is a string */}
      <form.NumberField name="title" label="Title" />
    </>
  );
}

// One form's dialog inside another form's tree. Each typed reader finds its own definition's form.
const lineDialog = forms.define({ defaultValues: { item: "", qty: 0 } });

function LineDialogBody() {
  const outer = useFormContext(order);
  const inner = useFormContext(lineDialog);
  expectTypeOf(outer.root).toEqualTypeOf<ObjectHandle<DraftOrder>>();
  expectTypeOf(inner.root).toEqualTypeOf<ObjectHandle<{ item: string; qty: number }>>();
  return <inner.Field name="qty">{(field) => <input {...field.inputProps({ kind: "number", empty: 0 })} />}</inner.Field>;
}

function LineDialog() {
  const dialog = useForm(lineDialog, { id: "line-dialog" });
  return (
    <dialog.Form>
      <LineDialogBody />
    </dialog.Form>
  );
}

// Reusable parts for any form. They read the nearest form with no definition and need no cast.
function GenericSubmit() {
  const form = useFormContext();
  expectTypeOf(form).toEqualTypeOf<UnknownForm>();
  const submitting = useFormState(form, (snapshot) => snapshot.submitting);
  return (
    <>
      <button type="submit" disabled={submitting} onClick={() => void form.submit()}>
        Save
      </button>
      <form {...form.formProps} onSubmit={(event) => void form.handleSubmit(event)} />
    </>
  );
}

function GenericReset() {
  const form = useFormContext();
  const dirty = useFormState(form, (snapshot) => snapshot.dirty);
  return (
    <button type="button" disabled={!dirty} onClick={() => form.store.reset()}>
      Reset
    </button>
  );
}

function GenericStatus() {
  const form = useFormContext();
  const state = useFormState(form);
  const disabled = useDisabledErrors(form);
  expectTypeOf(state.submission.status).toEqualTypeOf<"idle" | "submitting" | "invalid" | "succeeded" | "failed">();
  return (
    <p>
      {[state.valid, state.validating, state.dirty, state.submitting, state.submitCount, disabled.length].join(" ")}
    </p>
  );
}

// A definition made with the function form takes options in `useForm`.
const seeded = forms.define((options: { readonly title: string }) => ({ defaultValues: { title: options.title } }));

function OptionForms() {
  const form = useForm(seeded, { title: "a" }, { id: "seeded" });
  expectTypeOf(form).toEqualTypeOf<FormOf<typeof seeded>>();
  expectTypeOf(form.root).toEqualTypeOf<ObjectHandle<{ title: string }>>();
  expectTypeOf(useFormContext(seeded)).toEqualTypeOf<FormOf<typeof seeded>>();
  // @ts-expect-error: the options are required
  useForm(seeded);
  // @ts-expect-error: the options have the wrong type
  useForm(seeded, { title: 1 });
  // @ts-expect-error: a definition from a plain config takes no options
  useForm(profile, { title: "a" }, { id: "profile" });
  // @ts-expect-error: the settings come first when there are no options, and these are not settings
  useForm(profile, { title: "a" });
  return <form.Form>{null}</form.Form>;
}

describe("useForm and useFormContext", () => {
  it("types the form from the definition in both call forms", () => {
    expectTypeOf(useForm(order)).toEqualTypeOf<OrderForm>();
    expectTypeOf(useFormContext(order)).toEqualTypeOf<OrderForm>();
    expectTypeOf<FormOf<typeof order>>().toEqualTypeOf<OrderForm>();
    expectTypeOf(useFormContext()).toEqualTypeOf<UnknownForm>();
    expectTypeOf(OptionForms).toBeFunction();
    // @ts-expect-error: a form is not a definition
    useFormContext(useForm(order));
    // @ts-expect-error: a store is not a definition
    useForm(order.createStore());
  });

  it("gives a generic submit button, reset button and status line all they need with no cast", () => {
    expectTypeOf(GenericSubmit).toBeFunction();
    expectTypeOf(GenericReset).toBeFunction();
    expectTypeOf(GenericStatus).toBeFunction();
  });
});

describe("fieldsets and scopes", () => {
  it("types fieldsets from a schema and from a type, at two paths, in rows and in a second form", () => {
    expectTypeOf(AddressFields).toBeFunction();
    expectTypeOf(GeoFields).toBeFunction();
    expectTypeOf(ContactFields).toBeFunction();
    expectTypeOf(ProfileForm).toBeFunction();
    expectTypeOf(OrderWithFieldsets).toBeFunction();
    expectTypeOf(PlainNumbers).toBeFunction();
    // A fieldset only types the shape: it has no hook and takes no options.
    expectTypeOf(AddressShape).toEqualTypeOf<Fieldset<DraftAddress, FormError, Fields, Installed>>();
    // @ts-expect-error: scope takes the handle only
    AddressShape.scope(emptyHandle, { validate: false });
  });

  it("takes the schema's draft as the shape and any handle that fits it", () => {
    expectTypeOf<HandleOf<typeof AddressShape>>().toEqualTypeOf<FieldHandle<DraftAddress>>();
    expectTypeOf<FieldHandle<DraftOrder>>().toExtend<HandleOf<typeof ContactShape>>();
    expectTypeOf<ItemHandle<DraftAddress>>().toExtend<HandleOf<typeof AddressShape>>();
  });

  it("keeps nested forms apart in context", () => {
    expectTypeOf(LineDialog).toBeFunction();
  });
});

// form.State, typed from the form's intent and result types.
function SaveState() {
  const form = useForm(order);
  return (
    <>
      <form.State select={(snapshot) => snapshot.submission}>
        {(submission, owner) => {
          expectTypeOf(submission).toEqualTypeOf<Submission<"save" | "send" | undefined, { id: string }>>();
          expectTypeOf(owner).toEqualTypeOf<OrderForm>();
          return submission.status === "succeeded" ? <p>{submission.result.id}</p> : null;
        }}
      </form.State>
      <form.State select={(snapshot) => snapshot.submitCount} isEqual={(a, b) => a === b}>
        {(count) => {
          expectTypeOf(count).toEqualTypeOf<number>();
          return <p>{count}</p>;
        }}
      </form.State>
      {/* @ts-expect-error: isEqual compares what select returns */}
      <form.State select={(snapshot) => snapshot.submitCount} isEqual={(a: string, b: string) => a === b}>
        {(count) => <p>{count}</p>}
      </form.State>
      {/* @ts-expect-error: the form snapshot has no such member */}
      <form.State select={(snapshot) => snapshot.missing}>{() => null}</form.State>
      <form.State select={(snapshot) => snapshot.dirty}>
        {/* @ts-expect-error: children must be a render function */}
        <p />
      </form.State>
    </>
  );
}

describe("form.State", () => {
  it("types select from the form snapshot and children from what select returns", () => {
    expectTypeOf(SaveState).toBeFunction();
    expectTypeOf<OrderForm["State"]>().toEqualTypeOf<FormStateComponent<"save" | "send" | undefined, { id: string }, OrderForm>>();
    expectTypeOf<UnknownForm["State"]>().toEqualTypeOf<FormStateComponent<unknown, unknown, UnknownForm>>();
  });
});

function Checkbox(props: { readonly field: FieldApi<boolean>; readonly label: string }) {
  return (
    <label>
      <input {...props.field.inputProps({ kind: "checkbox" })} />
      {props.label}
    </label>
  );
}

interface Pickup {
  pickup: boolean;
  note: string;
}

const checkboxForms = createForms({ fields: { Checkbox, TextField } });
const pickupOrder = checkboxForms.define({ defaultValues: { pickup: false, note: "" } satisfies Pickup });
const pickupConst = checkboxForms.define({ defaultValues: { pickup: false, note: "" } as const });

function PickupFields() {
  const satisfied = useForm(pickupOrder);
  const constant = useForm(pickupConst);
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
    expectTypeOf(useForm(pickupOrder).root.at("pickup")).toEqualTypeOf<LeafHandle<boolean>>();
  });
});

// Each field object's commands take back the readonly value the field object holds.
function WriteBack() {
  const form = useForm(order);
  return (
    <>
      <form.Field name="billing">
        {(field) => {
          field.setValue(field.value, { replace: true });
          field.setValue({ geo: field.value.geo });
          // @ts-expect-error: an address has no country
          field.setValue({ country: "FR" });
          // @ts-expect-error: city is a string
          field.setValue({ city: 1 });
          return null;
        }}
      </form.Field>
      <form.Field name="lines">
        {(field) => {
          field.setValue(field.value);
          const [first] = field.value;
          if (first) {
            field.push(first);
            field.insert(0, first);
          }
          // @ts-expect-error: a line has no note
          field.push({ item: "", qty: 1, note: "" });
          // @ts-expect-error: qty is a number
          field.push({ item: "", qty: "1" });
          return null;
        }}
      </form.Field>
      <form.Field name="channels">
        {(field) => {
          field.setValue(field.value);
          return null;
        }}
      </form.Field>
    </>
  );
}

function TagsField(props: { readonly field: FieldApi<string[]> }) {
  props.field.setValue(props.field.value);
  return null;
}

describe("writing back a value read from a field object", () => {
  it("compiles for objects, arrays and array items", () => {
    expectTypeOf(WriteBack).toBeFunction();
    expectTypeOf(TagsField).toBeFunction();
  });
});
