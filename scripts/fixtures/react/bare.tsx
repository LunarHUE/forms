// A form with one field, bound by hand through `form.Field`.
import { createForms, useForm } from "@lunarhue/forms-react";
import { TextInput } from "./input.js";

const forms = createForms();
const signIn = forms.define({ defaultValues: { email: "" }, onSubmit: (value) => value.email });

export function App() {
  const form = useForm(signIn);
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
