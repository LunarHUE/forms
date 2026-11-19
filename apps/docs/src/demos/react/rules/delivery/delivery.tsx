import { createForms, useForm } from "@lunarhue/forms-react";
import { Checkbox, TextField } from "./fields";
import { orderRules } from "./rules";

const forms = createForms({ fields: { TextField, Checkbox } });

const order = forms.define({
  defaultValues: { pickup: false, gift: false, street: "", message: "" },
  plugins: [orderRules],
  onSubmit: (value) => value,
});

export default function DeliveryForm() {
  const form = useForm(order);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Checkbox name="pickup" label="I'll pick it up" />
          <form.TextField name="street" label="Street" />
          <form.Checkbox name="gift" label="It's a gift" />
          <form.TextField name="message" label="Gift message" />
          <button type="submit">Order</button>
        </form>
      )}
    </form.Form>
  );
}
