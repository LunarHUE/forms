// What an app or a shared forms package exports, with every type left to inference.
// tsc writes declarations for this file, and fails if one of these types names
// something the adapter doesn't export.
import {
  createField,
  createForm,
  createForms,
  createInputProps,
  createItems,
  type Choice,
  type ExactFieldApi,
  type FieldApi,
  type FormOf,
  type HandleOf,
  useFormContext,
} from "@lunarhue/forms-solid";
import { history } from "@lunarhue/forms-solid/plugins/history";
import { digits, mask } from "@lunarhue/forms-solid/plugins/mask";
import { rules } from "@lunarhue/forms-solid/plugins/rules";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { TextField } from "./input.js";

export { TextField };

export function NumberField(props: { readonly field: FieldApi<number>; readonly label: string }) {
  return (
    <label>
      {props.label}
      <input
        type="number"
        value={props.field.value}
        onInput={(event) => props.field.setValue(event.currentTarget.valueAsNumber)}
        onBlur={() => props.field.handleBlur()}
      />
    </label>
  );
}

export function SelectField(props: { readonly field: FieldApi<Choice>; readonly options: readonly Choice[] }) {
  return (
    <select value={String(props.field.value ?? "")} onBlur={() => props.field.handleBlur()}>
      {props.options.map((option) => (
        <option>{option}</option>
      ))}
    </select>
  );
}

export function NoteField(props: { readonly field: ExactFieldApi<string> }) {
  return <textarea value={props.field.value} onInput={(event) => props.field.setValue(event.currentTarget.value)} />;
}

export const forms = createForms({ plugins: [valibot(), history()], fields: { TextField, NumberField, SelectField, NoteField } });

export const AddressSchema = v.object({ street: v.string(), city: v.pipe(v.string(), v.minLength(1)) });
export const Address = forms.fieldset(AddressSchema);
export const Contact = forms.fieldset<{ email: string; phone: string }>();

export const orderRules = rules<{ pickup: boolean; address: { street: string; city: string } }>({
  address: (value) => ({ disabled: value.pickup }),
});

export const order = forms.define({
  schema: v.object({
    pickup: v.boolean(),
    qty: v.number(),
    address: AddressSchema,
    contact: v.object({ email: v.string(), phone: v.string() }),
    lines: v.array(v.object({ item: v.string() })),
  }),
  plugins: [mask({ "contact.phone": digits }), orderRules],
  onSubmit: (value) => ({ id: value.address.city }),
});

export const note = forms.define({ defaultValues: { text: "" }, readOnly: { text: true } });

export type OrderForm = FormOf<typeof order>;

export function createOrder() {
  return createForm(order);
}

export function createQty(form: OrderForm) {
  return createField(form.root.at("qty"));
}

export function createQtyInput(form: OrderForm) {
  return createInputProps(form.root.at("qty"), { kind: "number" });
}

export function createPickupInput(form: OrderForm) {
  return createInputProps(form.root.at("pickup"), { kind: "checkbox" });
}

export function createLines(form: OrderForm) {
  return createItems(form.root.at("lines"));
}

export function orderState(form: OrderForm) {
  return form.state;
}

export function anyOrderForm() {
  return useFormContext(forms);
}

export function orderParts(form: OrderForm) {
  return {
    Field: form.Field,
    Items: form.Items,
    TextField: form.TextField,
    NumberField: form.NumberField,
    SelectField: form.SelectField,
    NoteField: form.NoteField,
  };
}

export function rootScope(form: OrderForm) {
  return forms.scope(form.root);
}

export function addressScope(handle: HandleOf<typeof Address>) {
  return Address.scope(handle);
}

export function contactScope(handle: HandleOf<typeof Contact>) {
  return forms.scope(handle);
}

export function AddressFields(props: { readonly handle: HandleOf<typeof Address> }) {
  const scope = Address.scope(props.handle);
  return (
    <fieldset>
      <scope.TextField name="street" label="Street" />
      <scope.TextField name="city" label="City" />
    </fieldset>
  );
}

export function OrderPage() {
  const form = createOrder();
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.NumberField name="qty" label="Qty" />
          <AddressFields handle={form.root.at("address")} />
          <button type="button" onClick={() => form.plugins.history.undo()}>
            Undo
          </button>
        </form>
      )}
    </form.Form>
  );
}
