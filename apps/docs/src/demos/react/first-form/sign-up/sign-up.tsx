import { createForms, inputProps, useForm } from "@lunarhue/forms-react";
import { docsDevtools } from "@/devtools/enabled";

// No plugins and no field components: this form uses only what every form has.
const forms = createForms({ plugins: [docsDevtools] });

const signUp = forms.define({
  defaultValues: { name: "", email: "" },
  onSubmit: (value) => `Signed up ${value.name}.`,
});

export default function SignUpForm() {
  const form = useForm(signUp, { id: "sign-up" });
  return (
    <form {...form.formProps}>
      <form.Field name="name">
        {(field) => (
          <label>
            Name
            <input {...inputProps(field)} />
          </label>
        )}
      </form.Field>
      <form.Field name="email">
        {(field) => (
          <label>
            Email
            <input {...inputProps(field, { type: "email" })} />
          </label>
        )}
      </form.Field>
      <button type="submit">Sign up</button>
      <form.State select={(state) => state.submission}>
        {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
      </form.State>
    </form>
  );
}
