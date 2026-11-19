import { createForms, field, useForm } from "@lunarhue/forms-react";
import { digits, mask, masked } from "@lunarhue/forms-react/plugins";
import { zod } from "@lunarhue/forms-schema/zod";
import { z } from "zod";
import { CheckboxField, NumberField, TextField } from "./fields";

// "5551234567" shows as "(555) 123-4567".
function formatPhone(value: string) {
  if (value.length > 6) return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
  if (value.length > 3) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
  return value;
}

const PhoneField = field(TextField, masked({ clean: digits, display: formatPhone }));

const forms = createForms({
  plugins: [zod(), mask()],
  fields: { TextField, NumberField, CheckboxField, PhoneField },
});

const Order = z.object({
  phone: z.string().length(10, "Enter a 10-digit phone number."),
  quantity: z.number("Enter a quantity.").min(0.5, "Order at least half a box."),
  terms: z.boolean().refine((value) => value, "Accept the terms."),
});

const order = forms.define({
  schema: Order,
  defaultValues: { terms: false },
  onSubmit: (value) => value,
});

export default function OrderForm() {
  const form = useForm(order);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.PhoneField name="phone" label="Phone" />
          <form.NumberField name="quantity" label="Boxes" />
          <form.CheckboxField name="terms" label="I accept the terms" />
          <div>
            <button type="submit">Order</button>
            <button type="button" onClick={() => form.root.reset()}>
              Clear
            </button>
          </div>
        </form>
      )}
    </form.Form>
  );
}
