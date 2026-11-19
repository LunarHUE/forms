// The bare form with an array of fields: items rendered by `form.Items`, added, removed and moved.
import { createForm, createForms } from "@lunarhue/forms-solid";
import { arrays } from "@lunarhue/forms-solid/plugins";
import { TextInput } from "./input.js";

const forms = createForms({ plugins: [arrays()] });
const invite = forms.define({ defaultValues: { emails: [{ address: "" }] }, onSubmit: (value) => value.emails });

export function App() {
  const form = createForm(invite);
  const emails = form.root.at("emails");
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Items name="emails">
            {(email, index) => (
              <div>
                <form.Field handle={email.at("address")}>{(field) => <TextInput field={field} />}</form.Field>
                <button type="button" onClick={() => emails.move(index(), index() - 1)}>
                  Up
                </button>
                <button type="button" onClick={() => emails.remove(index())}>
                  Remove
                </button>
              </div>
            )}
          </form.Items>
          <button type="button" onClick={() => emails.push({ address: "" })}>
            Add
          </button>
          <button type="submit">Invite</button>
        </form>
      )}
    </form.Form>
  );
}
