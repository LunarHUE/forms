import { createForms, useForm } from "@lunarhue/forms-react";
import { digits, mask } from "@lunarhue/forms-react/plugins";
import { NumberField, PhoneField } from "./fields";

// "5551234567" shows as "(555) 123-4567".
function formatPhone(value: string) {
  if (value.length > 6) return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
  if (value.length > 3) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
  return value;
}

const forms = createForms({ fields: { NumberField, PhoneField } });

const order = forms.define({
  defaultValues: { price: undefined as number | undefined, phone: "" },
  plugins: [mask({ phone: { clean: digits, display: formatPhone } })],
});

export default function OrderForm() {
  const form = useForm(order);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.NumberField name="price" label="Price" />
          <form.PhoneField name="phone" label="Phone" />
        </form>
      )}
    </form.Form>
  );
}
