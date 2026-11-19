// The bare form validated by a Valibot schema. Valibot itself stays out of the count.
import { createForms, useForm } from "@lunarhue/forms-react";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { TextInput } from "./input.js";

const forms = createForms({ plugins: [valibot()] });
const signIn = forms.define({
  schema: v.object({ email: v.pipe(v.string(), v.email("Enter an email.")) }),
  onSubmit: (value) => value.email,
});

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
