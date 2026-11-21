// Every plugin, a schema, a registered field, an array and a fieldset. Valibot stays out of the count.
import { Items, createForms, defineField, useForm, fieldValidators } from "@lunarhue/forms-react";
import { arrays, baselineOnSubmit, bind, dirty, history, persist, rebase, ruled, rules } from "@lunarhue/forms-react/plugins";
import { digits, masked } from "@lunarhue/forms-react/text";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { TextField, TextInput } from "./input.js";

const Order = v.object({
  phone: v.string(),
  note: v.string(),
  address: v.object({ street: v.string(), city: v.pipe(v.string(), v.minLength(1, "Enter a city.")) }),
  lines: v.array(v.object({ item: v.string() })),
});
type Order = v.InferOutput<typeof Order>;

let saved: Order = { phone: "", note: "", address: { street: "", city: "" }, lines: [{ item: "" }] };
const listeners = new Set<() => void>();

const PhoneField = defineField(TextField, masked({ clean: digits, display: (value) => value.replace(/(\d{3})(?=\d)/g, "$1 ") }));

const forms = createForms({
  plugins: [valibot(), arrays(), dirty(), baselineOnSubmit(), history(), persist("order"), rebase(), rules()],
  fields: { TextField, PhoneField },
});
const Address = forms.fieldset(Order.entries.address);

const order = forms.define(
  {
  schema: Order,
  plugins: [
    bind<Order>({
      get: () => saved,
      set: (value) => {
        saved = value;
        for (const listener of listeners) listener();
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
  ],
  validate: { fields: fieldValidators({ phone: (value) => (value.length < 10 ? { message: "Enter ten digits." } : undefined) }) },
  onSubmit: (value) => value.phone,
  },
  ruled({ note: (value) => ({ hidden: value.phone === "" }) }),
);

export function App() {
  const form = useForm(order);
  const address = Address.scope(form.root.at("address"));
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.PhoneField name="phone" label="Phone" />
          <form.Field name="note">{(note) => (rules.meta(note).hidden ? null : <TextInput field={note} />)}</form.Field>
          <address.TextField name="street" label="Street" />
          <address.TextField name="city" label="City" />
          <Items handle={form.root.at("lines")}>
            {(line) => <form.TextField handle={line.at("item")} label="Item" />}
          </Items>
          <button type="button" onClick={() => form.plugins.history.undo()}>
            Undo
          </button>
          <button type="submit">Order</button>
        </form>
      )}
    </form.Form>
  );
}
