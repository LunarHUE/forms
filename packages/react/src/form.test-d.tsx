import { describe, expectTypeOf, it } from "vitest";
import type { ComponentProps } from "react";
import {
  createForms,
  type FieldApi,
  type FieldHandle,
  type FormError,
  type FormInstance,
  type FormSnapshot,
  type FormStore,
  type HandleOf,
  type ItemHandle,
  type LeafHandle,
  type ObjectHandle,
  type ReactFormDefinition,
  type SchemaAdapter,
  type StandardSchemaV1,
  type Submission,
  useFormContext,
  useFormState,
} from "./index.js";

// A schema type an adapter supports, as in core's type tests. No schema library is needed.
interface FakeSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly fake: true;
}
declare const fakeAdapter: SchemaAdapter<FakeSchema<unknown>>;

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

function NumberField(props: { readonly field: FieldApi<number | undefined>; readonly label: string }) {
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps({ kind: "number" })} />
    </label>
  );
}

const forms = createForms({ schemas: [fakeAdapter], fields: { TextField, NumberField } });

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
};
type Fields = { readonly TextField: typeof TextField; readonly NumberField: typeof NumberField };
type OrderForm = FormInstance<DraftOrder, FormError, "save" | "send" | undefined, { id: string }, Fields>;

function OrderPage() {
  const form = order.useForm();
  expectTypeOf(form).toEqualTypeOf<OrderForm>();
  expectTypeOf(form.root).toEqualTypeOf<ObjectHandle<DraftOrder>>();
  expectTypeOf(form.store).toEqualTypeOf<FormStore<DraftOrder, FormError, "save" | "send" | undefined, { id: string }>>();
  expectTypeOf(form.submit("send")).toEqualTypeOf<Promise<Submission<"save" | "send" | undefined, { id: string }>>>();
  // @ts-expect-error: not one of the intents
  void form.submit("delete");

  return (
    <form.Form>
      {({ submit, ...props }) => (
        <form {...props}>
          <form.TextField name="customer" label="Customer" placeholder="Name" />
          <form.TextField name="billing.city" label="City" />
          <form.NumberField name="age" label="Age" />
          <form.Field name="email">
            {(field) => {
              expectTypeOf(field.value).toEqualTypeOf<string>();
              expectTypeOf(field.handle).toEqualTypeOf<LeafHandle<string>>();
              return <input type="email" {...field.inputProps()} />;
            }}
          </form.Field>
          <form.Items name="lines">
            {(line) => {
              expectTypeOf(line).toEqualTypeOf<ItemHandle<DraftLine>>();
              return <Line line={line} />;
            }}
          </form.Items>
          <SubmitButton />
          <button type="button" onClick={() => void submit("send")}>
            Send
          </button>
        </form>
      )}
    </form.Form>
  );
}

// Fields given by handle, here an item handle passed as a prop with no provider.
function Line({ line }: { readonly line: ItemHandle<DraftLine> }) {
  const form = order.useFormContext();
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
  const form = order.useForm();
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
      {/* @ts-expect-error: customer is a string, NumberField edits number | undefined */}
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

describe("createForms", () => {
  it("rejects field components that collide with form members or have no field prop", () => {
    // @ts-expect-error: Field is the form's own member
    createForms({ fields: { Field: TextField } });
    // @ts-expect-error: submit is the form's own member
    createForms({ fields: { submit: TextField } });
    // @ts-expect-error: a field component needs a field prop
    createForms({ fields: { Label: (props: { readonly text: string }) => <span>{props.text}</span> } });
    expectTypeOf(createForms({ fields: { TextField } })).toBeObject();
  });

  it("carries V, E, I, R and the fields from the definition", () => {
    expectTypeOf(order).toEqualTypeOf<
      ReactFormDefinition<DraftOrder, FormError, "save" | "send" | undefined, { id: string }, void, Fields>
    >();
  });
});

describe("the form object", () => {
  it("types useForm, Form, Field, Items and the registered components with no annotations", () => {
    expectTypeOf(OrderPage).toBeFunction();
    expectTypeOf(Line).toBeFunction();
    expectTypeOf(WrongUsage).toBeFunction();
  });

  it("gives form.Form's child the form element props", () => {
    type RenderProps = Parameters<Extract<ComponentProps<OrderForm["Form"]>["children"], (...args: never[]) => unknown>>[0];
    type ElementProps = Omit<RenderProps, "submit">;
    expectTypeOf<ElementProps>().toExtend<ComponentProps<"form">>();
    expectTypeOf<OrderForm["formProps"]>().toExtend<ComponentProps<"form">>();
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
  const scope = GeoShape.useScope(props.field);
  return (
    <>
      <scope.NumberField name="lat" label="Latitude" />
      <scope.NumberField name="lng" label="Longitude" />
    </>
  );
}

function AddressFields(props: { readonly field: HandleOf<typeof AddressShape>; readonly title: string }) {
  const scope = AddressShape.useScope(props.field);
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
  const scope = ContactShape.useScope(props.field);
  return (
    <>
      <scope.TextField name="customer" label="Customer" />
      <scope.TextField name="email" label="Email" />
    </>
  );
}

// A second form that uses the same fieldset.
const emptyAddress: DraftAddress = { street: "", city: "", zip: "", geo: { lat: undefined, lng: undefined } };
const profile = forms.define({ defaultValues: { home: emptyAddress } });

function ProfileForm() {
  const form = profile.useForm();
  return (
    <form.Form>
      <AddressFields field={form.root.at("home")} title="Home" />
    </form.Form>
  );
}

function OrderWithFieldsets() {
  const form = order.useForm();
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

function SkipSchema(props: { readonly field: HandleOf<typeof AddressShape> }) {
  const scope = AddressShape.useScope(props.field, { validate: false });
  // @ts-expect-error: a fieldset made from a type has no schema to skip
  GeoShape.useScope(scope.root.at("geo"), { validate: false });
  return <scope.TextField name="street" label="Street" />;
}

// One form's dialog inside another form's tree. Each typed reader finds its own definition's form.
const lineDialog = forms.define({ defaultValues: { item: "", qty: 0 } });

function LineDialogBody() {
  const outer = order.useFormContext();
  const inner = lineDialog.useFormContext();
  expectTypeOf(outer.root).toEqualTypeOf<ObjectHandle<DraftOrder>>();
  expectTypeOf(inner.root).toEqualTypeOf<ObjectHandle<{ item: string; qty: number }>>();
  return <inner.Field name="qty">{(field) => <input {...field.inputProps({ kind: "number", empty: 0 })} />}</inner.Field>;
}

function LineDialog() {
  const dialog = lineDialog.useForm({ id: "line-dialog" });
  return (
    <dialog.Form>
      <LineDialogBody />
    </dialog.Form>
  );
}

describe("fieldsets and scopes", () => {
  it("types fieldsets from a schema and from a type, at two paths, in rows and in a second form", () => {
    expectTypeOf(AddressFields).toBeFunction();
    expectTypeOf(GeoFields).toBeFunction();
    expectTypeOf(ContactFields).toBeFunction();
    expectTypeOf(ProfileForm).toBeFunction();
    expectTypeOf(OrderWithFieldsets).toBeFunction();
    expectTypeOf(SkipSchema).toBeFunction();
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
