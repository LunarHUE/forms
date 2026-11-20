import { createForm, createForms, inputProps } from "@lunarhue/forms-solid";
import { Show } from "solid-js";

// No plugins and no field components: this form uses only what every form has.
const forms = createForms();

const signUp = forms.define({
  defaultValues: { name: "", email: "" },
  onSubmit: (value) => `Signed up ${value.name}.`,
});

export default function SignUpForm() {
  const form = createForm(signUp);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
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
          <p role="status">
            <Show when={form.state.submission.status === "succeeded" && form.state.submission}>
              {(submission) => submission().result}
            </Show>
          </p>
        </form>
      )}
    </form.Form>
  );
}
