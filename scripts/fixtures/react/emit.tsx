// What an app or a shared forms package exports, with every type left to inference.
// tsc writes declarations for this file, and fails if one of these types names
// something the adapter doesn't export.
import {
  createForms,
  field as fieldType,
  type Choice,
  type ExactFieldApi,
  type FieldApi,
  type FormOf,
  type HandleOf,
  useField,
  useForm,
  useFormContext,
  useFormState,
  useInputProps,
  useItems,
} from "@lunarhue/forms-react";
import { digits, history, mask, masked, ruled, rules } from "@lunarhue/forms-react/plugins";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { TextField } from "./input.js";

export { TextField };

export function NumberField({ field, label }: { readonly field: FieldApi<number>; readonly label: string }) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={field.value}
        onChange={(event) => field.setValue(event.target.valueAsNumber)}
        onBlur={() => field.handleBlur()}
      />
    </label>
  );
}

export function SelectField({ field, options }: { readonly field: FieldApi<Choice>; readonly options: readonly Choice[] }) {
  return (
    <select defaultValue={String(field.value ?? "")} onBlur={() => field.handleBlur()}>
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

export function NoteField({ field }: { readonly field: ExactFieldApi<string> }) {
  return <textarea value={field.value} onChange={(event) => field.setValue(event.target.value)} />;
}

export const PhoneField = fieldType(TextField, masked({ clean: digits }));

export const forms = createForms({
  plugins: [valibot(), history(), mask(), rules()],
  fields: { TextField, NumberField, SelectField, NoteField, PhoneField },
});

export const AddressSchema = v.object({ street: v.string(), city: v.pipe(v.string(), v.minLength(1)) });
export const Address = forms.fieldset(AddressSchema);
export const Contact = forms.fieldset<{ email: string; phone: string }, "rules">(
  ruled({ email: (value) => ({ hidden: value.phone !== "" }) }),
);

export const order = forms.define(
  {
  schema: v.object({
    pickup: v.boolean(),
    qty: v.number(),
    address: AddressSchema,
    contact: v.object({ email: v.string(), phone: v.string() }),
    lines: v.array(v.object({ item: v.string() })),
  }),
  onSubmit: (value) => ({ id: value.address.city }),
  },
  ruled({ address: (value) => ({ disabled: value.pickup }) }),
  PhoneField.at("contact.phone"),
);

export const isHidden = rules.meta;

export const note = forms.define({ defaultValues: { text: "" }, readOnly: { text: true } });

export type OrderForm = FormOf<typeof order>;

export function useOrder() {
  return useForm(order);
}

export function useQty(form: OrderForm) {
  return useField(form.root.at("qty"));
}

export function useQtyInput(form: OrderForm) {
  return useInputProps(form.root.at("qty"), { kind: "number" });
}

export function usePickupInput(form: OrderForm) {
  return useInputProps(form.root.at("pickup"), { kind: "checkbox" });
}

export function useLines(form: OrderForm) {
  return useItems(form.root.at("lines"));
}

export function useSubmitting(form: OrderForm) {
  return useFormState(form, (state) => state.submission);
}

export function useAnyOrderForm() {
  return useFormContext(forms);
}

export function orderParts(form: OrderForm) {
  return {
    Field: form.Field,
    Items: form.Items,
    State: form.State,
    TextField: form.TextField,
    NumberField: form.NumberField,
    SelectField: form.SelectField,
    NoteField: form.NoteField,
    PhoneField: form.PhoneField,
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

export function AddressFields({ handle }: { readonly handle: HandleOf<typeof Address> }) {
  const scope = Address.scope(handle);
  return (
    <fieldset>
      <scope.TextField name="street" label="Street" />
      <scope.TextField name="city" label="City" />
    </fieldset>
  );
}

export function OrderPage() {
  const form = useOrder();
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
