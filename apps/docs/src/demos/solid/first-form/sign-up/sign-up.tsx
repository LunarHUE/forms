import { createForm, createForms } from "@lunarhue/forms-solid";
import { zod } from "@lunarhue/forms-schema/zod";
import { Show } from "solid-js";
import { z } from "zod";
import { TextField } from "./TextField";

const forms = createForms({
  plugins: [zod()],
  fields: { TextField },
});

const SignUp = z.object({
  name: z.string().min(1, "Enter your name."),
  email: z.email("Enter a valid email."),
});

const signUp = forms.define({
  schema: SignUp,
  onSubmit: (value) => `Signed up ${value.name}.`,
});

export default function SignUpForm() {
  const form = createForm(signUp);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
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
