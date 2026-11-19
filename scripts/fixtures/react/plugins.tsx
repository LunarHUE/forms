// The bare form with a phone mask and a rule that hides a field.
import { createForms, useForm } from "@lunarhue/forms-react";
import { digits, mask, rules } from "@lunarhue/forms-react/plugins";
import { TextInput } from "./input.js";

interface Contact {
  phone: string;
  note: string;
}

const contactRules = rules<Contact>({ note: (value) => ({ hidden: value.phone === "" }) });

const forms = createForms();
const contact = forms.define({
  defaultValues: { phone: "", note: "" },
  plugins: [mask({ phone: { clean: digits, display: (value) => value.replace(/(\d{3})(?=\d)/g, "$1 ") } }), contactRules],
  onSubmit: (value) => value.phone,
});

export function App() {
  const form = useForm(contact);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="phone">{(field) => <TextInput field={field} />}</form.Field>
          <form.Field name="note">
            {(field) => (contactRules.meta(field).hidden ? null : <TextInput field={field} />)}
          </form.Field>
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
