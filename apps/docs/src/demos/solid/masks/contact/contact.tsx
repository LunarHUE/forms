import { createForm, createForms } from "@lunarhue/forms-solid";
import { mask } from "@lunarhue/forms-solid/plugins";
import { PhoneField } from "./PhoneField";
import { docsDevtools } from "@/devtools/enabled";

// PhoneField brings its mask part. The form only installs the plugin.
const forms = createForms({ plugins: [mask(), docsDevtools], fields: { PhoneField } });

const contact = forms.define({
  defaultValues: { phone: "" },
  // The store only ever holds digits, so `onSubmit` gets digits.
  onSubmit: (value) => value.phone,
});

export default function ContactForm() {
  const form = createForm(contact, { id: "contact" });
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
