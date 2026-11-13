import { describe, expectTypeOf, it } from "vitest";
import { useDeferredValue } from "react";
import {
  createForms,
  Field,
  FormProvider,
  Items,
  type ArrayHandle,
  type FieldSnapshot,
  type FormError,
  type FormInstance,
  type ItemHandle,
  type LeafHandle,
  type ObjectHandle,
  useField,
  useFormContext,
  useItems,
  useValidator,
} from "./index.js";

interface Row {
  title: string;
  qty: number;
}
interface Order {
  customer: { name: string; email: string };
  rows: Row[];
  note: string | undefined;
}
const emptyOrder: Order = { customer: { name: "", email: "" }, rows: [], note: undefined };

const forms = createForms();
const orderForm = forms.define({ defaultValues: emptyOrder, onSubmit: (value) => value.rows.length });

function Name({ name }: { readonly name: LeafHandle<string> }) {
  const snapshot = useField(name);
  expectTypeOf(snapshot).toEqualTypeOf<FieldSnapshot<string>>();
  expectTypeOf(snapshot.value).toEqualTypeOf<string>();
  return <span>{snapshot.value}</span>;
}

function Customer() {
  const form = orderForm.useForm();
  const customer = useField(form.root.at("customer"));
  expectTypeOf(customer.value).toEqualTypeOf<{ readonly name: string; readonly email: string }>();
  const rows = useField(form.root.at("rows"));
  expectTypeOf(rows.keys).toEqualTypeOf<readonly string[]>();
  expectTypeOf(rows.value).toEqualTypeOf<readonly { readonly title: string; readonly qty: number }[]>();
  // @ts-expect-error: a snapshot is not a handle
  useField({ value: "" });
  // @ts-expect-error: a selector takes the snapshot
  useField(form.root, (value: string) => value);
  return <Name name={form.root.at("customer").at("name")} />;
}

function FirstError({ email }: { readonly email: LeafHandle<string> }) {
  const first = useField(email, (snapshot) => snapshot.shownErrors[0]?.message);
  expectTypeOf(first).toEqualTypeOf<string | undefined>();
  const errors = useField(
    email,
    (snapshot) => snapshot.shownErrors.map((error) => error.message),
    (a, b) => a.join() === b.join(),
  );
  expectTypeOf(errors).toEqualTypeOf<string[]>();
  return <span>{first}</span>;
}

// Snapshots are immutable, so a deferred one is still a whole, consistent snapshot.
function Preview({ note }: { readonly note: LeafHandle<string | undefined> }) {
  const snapshot = useField(note);
  const deferred = useDeferredValue(snapshot);
  expectTypeOf(deferred).toEqualTypeOf<FieldSnapshot<string | undefined>>();
  return <p>{deferred.value}</p>;
}

function RowList({ rows }: { readonly rows: ArrayHandle<Row[]> }) {
  const items = useItems(rows);
  expectTypeOf(items).toEqualTypeOf<readonly ItemHandle<Row>[]>();
  return (
    <ul>
      {items.map((item) => (
        <li key={item.key}>{item.id}</li>
      ))}
    </ul>
  );
}

function RowTitle({ row }: { readonly row: ItemHandle<Row> }) {
  const title = useField(row.at("title"), (snapshot) => snapshot.value);
  return <span>{title}</span>;
}

function RowItems({ rows }: { readonly rows: ArrayHandle<Row[]> }) {
  return (
    <Items handle={rows}>
      {(row, index) => {
        expectTypeOf(row).toEqualTypeOf<ItemHandle<Row>>();
        expectTypeOf(index).toEqualTypeOf<number>();
        return <RowTitle row={row} />;
      }}
    </Items>
  );
}

function NotAnArray({ customer }: { readonly customer: ObjectHandle<Order["customer"]> }) {
  // @ts-expect-error: an object handle has no items
  useItems(customer);
  // @ts-expect-error: a leaf handle has no items
  useItems(customer.at("name"));
  // @ts-expect-error: Items needs an array handle
  return <Items handle={customer}>{() => null}</Items>;
}

function Email({ email }: { readonly email: LeafHandle<string> }) {
  return (
    <Field handle={email}>
      {(snapshot, handle) => {
        expectTypeOf(snapshot).toEqualTypeOf<FieldSnapshot<string>>();
        expectTypeOf(handle).toEqualTypeOf<LeafHandle<string>>();
        return <span>{snapshot.value}</span>;
      }}
    </Field>
  );
}

function Count({ rows }: { readonly rows: ArrayHandle<Row[]> }) {
  return (
    <Field handle={rows} select={(snapshot) => snapshot.keys.length}>
      {(count) => {
        expectTypeOf(count).toEqualTypeOf<number>();
        return <span>{count}</span>;
      }}
    </Field>
  );
}

function EmailCheck({ email }: { readonly email: LeafHandle<string> }) {
  useValidator(email, (value) => {
    expectTypeOf(value).toEqualTypeOf<string>();
    return value.includes("@") ? undefined : { message: "Enter an email" };
  });
  useValidator(email, {
    validate: async (value, ctx) => {
      const response = await fetch(`/taken?email=${value}`, { signal: ctx.signal });
      return response.ok ? undefined : { message: "Taken" };
    },
    debounce: 300,
  });
  return <span />;
}

function NoteCheck({ note, required }: { readonly note: LeafHandle<string | undefined>; readonly required: boolean }) {
  useValidator(note, required && ((value) => (value ? undefined : { message: "Required" })));
  return <span />;
}

function WrongValidator({ qty }: { readonly qty: LeafHandle<number> }) {
  // @ts-expect-error: qty is a number
  useValidator(qty, (value: string) => (value ? undefined : { message: "" }));
  // @ts-expect-error: the form's error type is FormError
  useValidator(qty, () => ({ code: 1 }));
  return <span />;
}

function Summary() {
  const form = orderForm.useFormContext();
  expectTypeOf(form).toEqualTypeOf<FormInstance<Order, FormError, undefined, number>>();
  const loose = useFormContext();
  expectTypeOf(loose.id).toEqualTypeOf<string>();
  return <span>{form.id}</span>;
}

function OrderPage() {
  const form = orderForm.useForm();
  return (
    <FormProvider form={form}>
      <form {...form.formProps}>
        <Summary />
        <RowItems rows={form.root.at("rows")} />
      </form>
    </FormProvider>
  );
}

describe("reading fields", () => {
  it("types useField by the handle, with and without a selector", () => {
    expectTypeOf(Name).toBeFunction();
    expectTypeOf(Customer).toBeFunction();
    expectTypeOf(FirstError).toBeFunction();
    expectTypeOf(Preview).toBeFunction();
  });

  it("types useItems, Items and Field", () => {
    expectTypeOf(RowList).toBeFunction();
    expectTypeOf(RowItems).toBeFunction();
    expectTypeOf(NotAnArray).toBeFunction();
    expectTypeOf(Email).toBeFunction();
    expectTypeOf(Count).toBeFunction();
  });

  it("types useValidator by the handle", () => {
    expectTypeOf(EmailCheck).toBeFunction();
    expectTypeOf(NoteCheck).toBeFunction();
    expectTypeOf(WrongValidator).toBeFunction();
  });

  it("types the context by the definition", () => {
    expectTypeOf(OrderPage).toBeFunction();
  });
});
