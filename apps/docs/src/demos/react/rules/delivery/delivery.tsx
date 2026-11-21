import { createForms, useForm } from "@lunarhue/forms-react";
import { ruled, rules } from "@lunarhue/forms-react/plugins";
import { Checkbox, TextField } from "./fields";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [rules(), docsDevtools], fields: { TextField, Checkbox } });

const order = forms.define(
  {
    defaultValues: { pickup: false, gift: false, street: "", message: "" },
    onSubmit: (value) => value,
  },
  // Each rule gets the whole value and returns flags for its field.
  ruled({
    street: (value) => ({ disabled: value.pickup }),
    message: (value) => ({ hidden: !value.gift }),
  }),
);

export default function DeliveryForm() {
  const form = useForm(order, { id: "delivery" });
  return (
    <form {...form.formProps}>
      <form.Checkbox name="pickup" label="I'll pick it up" />
      <form.TextField name="street" label="Street" />
      <form.Checkbox name="gift" label="It's a gift" />
      <form.TextField name="message" label="Gift message" />
      <button type="submit">Order</button>
    </form>
  );
}
