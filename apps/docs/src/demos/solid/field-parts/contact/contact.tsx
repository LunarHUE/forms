import { createForm, createForms } from "@lunarhue/forms-solid";
import { CodeField, PhoneField } from "./fields";
import { TextInput } from "./TextInput";
import { docsDevtools } from "@/devtools/enabled";

// The field types bring their parts. Masks need no plugin.
const forms = createForms({ plugins: [docsDevtools], fields: { TextInput, PhoneField, CodeField } });

const contact = forms.define({
  defaultValues: { name: "", phone: "", referral: "" },
  onSubmit: (value) => value,
});

export default function ContactForm() {
  const form = createForm(contact, { id: "contact" });
  return (
    <form {...form.formProps}>
      <form.TextInput name="name" label="Name" />
      <form.PhoneField name="phone" label="Phone" />
      <form.CodeField name="referral" label="Referral code" />
      <button type="submit">Save</button>
    </form>
  );
}
