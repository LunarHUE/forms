// The bare form with a phone mask and a rule that hides a field.
import { createForms, defineField, useForm } from "@lunarhue/forms-react";
import { ruled, rules } from "@lunarhue/forms-react/plugins";
import { digits, masked } from "@lunarhue/forms-react/text";
import { TextInput } from "./input.js";

const PhoneField = defineField(TextInput, masked({ clean: digits, display: (value) => value.replace(/(\d{3})(?=\d)/g, "$1 ") }));

const forms = createForms({ plugins: [rules()], fields: { PhoneField } });
const contact = forms.define(
  { defaultValues: { phone: "", note: "" }, onSubmit: (value) => value.phone },
  ruled({ note: (value) => ({ hidden: value.phone === "" }) }),
);

export function App() {
  const form = useForm(contact);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.PhoneField name="phone" />
          <form.Field name="note">{(note) => (rules.meta(note).hidden ? null : <TextInput field={note} />)}</form.Field>
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
