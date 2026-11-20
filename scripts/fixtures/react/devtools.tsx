// The bare form with `devtools()` installed.
import { devtools } from "@lunarhue/forms-devtools";
import { createForms, useForm } from "@lunarhue/forms-react";
import { TextInput } from "./input.js";

const forms = createForms({ plugins: [devtools()] });
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
