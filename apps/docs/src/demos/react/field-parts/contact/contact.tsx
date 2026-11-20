import { createForms, defineField, useForm } from "@lunarhue/forms-react";
import { digits, mask, masked, upper } from "@lunarhue/forms-react/plugins";
import { TextInput } from "./TextInput";

// "5551234567" shows as "(555) 123-4567".
function formatPhone(value: string) {
  if (value.length > 6) return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
  if (value.length > 3) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
  return value;
}

// Two field types from one component. Each part travels with its type.
const PhoneField = defineField(TextInput, masked({ clean: digits, display: formatPhone }));
const CodeField = defineField(TextInput, masked({ clean: upper, display: (value) => value }));

const forms = createForms({ plugins: [mask()], fields: { TextInput, PhoneField, CodeField } });

const contact = forms.define({
  defaultValues: { name: "", phone: "", referral: "" },
  onSubmit: (value) => value,
});

export default function ContactForm() {
  const form = useForm(contact);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextInput name="name" label="Name" />
          <form.PhoneField name="phone" label="Phone" />
          <form.CodeField name="referral" label="Referral code" />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
