import { createForm, createForms } from "@lunarhue/forms-solid";
import { Show } from "solid-js";
import { z } from "zod";
import { TextInput } from "./TextInput";
import { docsDevtools } from "@/devtools/enabled";

// Still no plugins. Any Standard Schema validates.
const forms = createForms({ plugins: [docsDevtools] });

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
  const form = createForm(signUp, { id: "sign-up" });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="username">{(field) => <TextInput field={field} label="Username" />}</form.Field>
          <form.Field name="email">{(field) => <TextInput field={field} label="Email" type="email" />}</form.Field>
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
