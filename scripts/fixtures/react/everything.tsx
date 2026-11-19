// Every plugin, a schema, a registered field, an array and a fieldset. Valibot stays out of the count.
import { createForms, useForm } from "@lunarhue/forms-react";
import { baselineOnSubmit, bind, digits, dirty, history, mask, persist, rebase, rules } from "@lunarhue/forms-react/plugins";
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

const orderRules = rules<Order>({ note: (value) => ({ hidden: value.phone === "" }) });

const forms = createForms({
  plugins: [valibot(), dirty(), baselineOnSubmit(), history(), persist("order"), rebase()],
  fields: { TextField },
});
const Address = forms.fieldset(Order.entries.address);

const order = forms.define({
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
    mask({ phone: { clean: digits, display: (value) => value.replace(/(\d{3})(?=\d)/g, "$1 ") } }),
    orderRules,
  ],
  validate: { fields: { phone: (value) => (value.length < 10 ? { message: "Enter ten digits." } : undefined) } },
  onSubmit: (value) => value.phone,
});

export function App() {
  const form = useForm(order);
  const address = Address.scope(form.root.at("address"));
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="phone" label="Phone" />
          <form.Field name="note">
            {(field) => (orderRules.meta(field).hidden ? null : <TextInput field={field} />)}
          </form.Field>
          <address.TextField name="street" label="Street" />
          <address.TextField name="city" label="City" />
          <form.Items name="lines">
            {(line) => <form.TextField handle={line.at("item")} label="Item" />}
          </form.Items>
          <button type="button" onClick={() => form.plugins.history.undo()}>
            Undo
          </button>
          <button type="submit">Order</button>
        </form>
      )}
    </form.Form>
  );
}
