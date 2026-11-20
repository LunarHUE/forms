import { createForms, useForm } from "@lunarhue/forms-react";
import { z } from "zod";
import { TextInput } from "./TextInput";

// Still no plugins. Any Standard Schema validates.
const forms = createForms();

const SignUp = z.object({
  username: z.string().min(3, "Use at least 3 characters."),
  email: z.email("Enter a valid email."),
});

const signUp = forms.define({
  schema: SignUp,
  // Without a schema plugin, give every starting value.
  defaultValues: { username: "", email: "" },
  // Runs alongside the schema.
  validate: {
    fields: {
      username: (name) => (name === "admin" ? { message: "That name is reserved." } : undefined),
    },
  },
  onSubmit: (value) => `Signed up ${value.username}.`,
});

export default function SignUpForm() {
  const form = useForm(signUp);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="username">{(field) => <TextInput field={field} label="Username" />}</form.Field>
          <form.Field name="email">{(field) => <TextInput field={field} label="Email" type="email" />}</form.Field>
          <button type="submit">Sign up</button>
          <form.State select={(state) => state.submission}>
            {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
          </form.State>
        </form>
      )}
    </form.Form>
  );
}
