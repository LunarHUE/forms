// The bare form with a phone mask and a rule that hides a field.
import { createForm, createForms, defineField } from "@lunarhue/forms-solid";
import { digits, mask, masked, ruled, rules } from "@lunarhue/forms-solid/plugins";
import { Show } from "solid-js";
import { TextInput } from "./input.js";

const PhoneField = defineField(TextInput, masked({ clean: digits, display: (value) => value.replace(/(\d{3})(?=\d)/g, "$1 ") }));

const forms = createForms({ plugins: [mask(), rules()], fields: { PhoneField } });
const contact = forms.define(
  { defaultValues: { phone: "", note: "" }, onSubmit: (value) => value.phone },
  ruled({ note: (value) => ({ hidden: value.phone === "" }) }),
);

export function App() {
  const form = createForm(contact);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.PhoneField name="phone" />
          <form.Field name="note">
            {(note) => (
              <Show when={!rules.meta(note).hidden}>
                <TextInput field={note} />
              </Show>
            )}
          </form.Field>
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
