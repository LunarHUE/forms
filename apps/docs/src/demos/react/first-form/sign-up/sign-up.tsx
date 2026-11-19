import { createForms, useForm } from "@lunarhue/forms-react";
import { zod } from "@lunarhue/forms-schema/zod";
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
  const form = useForm(signUp);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <form.TextField name="email" label="Email" />
          <button type="submit">Sign up</button>
          <form.State select={(state) => state.submission}>
            {(submission) => (
              <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>
            )}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}
