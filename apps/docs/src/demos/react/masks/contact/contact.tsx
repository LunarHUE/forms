import { createForms, useForm } from "@lunarhue/forms-react";
import { PhoneField } from "./PhoneField";
import { docsDevtools } from "@/devtools/enabled";

// PhoneField brings its mask part, which needs no plugin.
const forms = createForms({ plugins: [docsDevtools], fields: { PhoneField } });

const contact = forms.define({
  defaultValues: { phone: "" },
  // The store only ever holds digits, so `onSubmit` gets digits.
  onSubmit: (value) => value.phone,
});

export default function ContactForm() {
  const form = useForm(contact, { id: "contact" });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.PhoneField name="phone" label="Phone" />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
