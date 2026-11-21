// The registered field component form on the /mini entry.
import { createForms, useForm } from "@lunarhue/forms-react/mini";
import { TextField } from "./input.js";

const forms = createForms({ fields: { TextField } });
const signIn = forms.define({ defaultValues: { email: "" }, onSubmit: (value) => value.email });

export function App() {
  const form = useForm(signIn);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="email" label="Email" />
          <button type="submit">Sign in</button>
        </form>
      )}
    </form.Form>
  );
}
