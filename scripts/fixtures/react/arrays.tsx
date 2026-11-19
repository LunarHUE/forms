// The bare form with an array of fields: items rendered by `Items`, added, removed and moved.
import { Items, createForms, useForm } from "@lunarhue/forms-react";
import { arrays } from "@lunarhue/forms-react/plugins";
import { TextInput } from "./input.js";

const forms = createForms({ plugins: [arrays()] });
const invite = forms.define({ defaultValues: { emails: [{ address: "" }] }, onSubmit: (value) => value.emails });

export function App() {
  const form = useForm(invite);
  const emails = form.root.at("emails");
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <Items handle={form.root.at("emails")}>
            {(email, index) => (
              <div>
                <form.Field handle={email.at("address")}>{(field) => <TextInput field={field} />}</form.Field>
                <button type="button" onClick={() => emails.move(index, index - 1)}>
                  Up
                </button>
                <button type="button" onClick={() => emails.remove(index)}>
                  Remove
                </button>
              </div>
            )}
          </Items>
          <button type="button" onClick={() => emails.push({ address: "" })}>
            Add
          </button>
          <button type="submit">Invite</button>
        </form>
      )}
    </form.Form>
  );
}
