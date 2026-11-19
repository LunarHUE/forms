// The bare form plus one field validator in the definition.
import { createForm, createForms } from "@lunarhue/forms-solid";
import { TextInput } from "./input.js";

const forms = createForms();
const signIn = forms.define({
  defaultValues: { email: "" },
  validate: { fields: { email: (value) => (value.includes("@") ? undefined : { message: "Enter an email." }) } },
  onSubmit: (value) => value.email,
});

export function App() {
  const form = createForm(signIn);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="email">{(field) => <TextInput field={field} />}</form.Field>
          <button type="submit">Sign in</button>
        </form>
      )}
    </form.Form>
  );
}
