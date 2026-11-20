// The bare form with `devtools()` installed.
import { devtools } from "@lunarhue/forms-devtools";
import { createForm, createForms } from "@lunarhue/forms-solid";
import { TextInput } from "./input.js";

const forms = createForms({ plugins: [devtools()] });
const signIn = forms.define({ defaultValues: { email: "" }, onSubmit: (value) => value.email });

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
