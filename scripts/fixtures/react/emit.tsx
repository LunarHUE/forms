// What an app or a shared forms package exports, with every type left to inference.
// tsc writes declarations for this file, and fails if one of these types names
// something the adapter doesn't export.
import { createForms, type FieldApi, type FormOf, type HandleOf, useField, useForm } from "@lunarhue/forms-react";
import { history } from "@lunarhue/forms-react/plugins/history";
import { digits, mask } from "@lunarhue/forms-react/plugins/mask";
import { rules } from "@lunarhue/forms-react/plugins/rules";
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

export const forms = createForms({ plugins: [valibot(), history()], fields: { TextField, NumberField } });

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

export function useOrder() {
  return useForm(order);
}

export function useQty(form: OrderForm) {
  return useField(form.root.at("qty"));
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
