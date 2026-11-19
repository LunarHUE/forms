// The bare form with a phone mask and a rule that hides a field.
import { createForm, createForms } from "@lunarhue/forms-solid";
import { digits, mask } from "@lunarhue/forms-solid/plugins/mask";
import { rules } from "@lunarhue/forms-solid/plugins/rules";
import { Show } from "solid-js";
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
  const form = createForm(contact);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="phone">{(field) => <TextInput field={field} />}</form.Field>
          <form.Field name="note">
            {(field) => (
              <Show when={!contactRules.meta(field).hidden}>
                <TextInput field={field} />
              </Show>
            )}
          </form.Field>
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
