import { createForms, useForm } from "@lunarhue/forms-react";
import { zod } from "@lunarhue/forms-schema/zod";
import { z } from "zod";
import { TextField } from "./TextField";

const forms = createForms({ plugins: [zod()], fields: { TextField } });

const SignUp = z.object({
  username: z.string().min(3, "Use at least 3 characters."),
  email: z.email("Enter a valid email."),
});

// Stands in for a request to your server. "ada" and "grace" are taken.
function isTaken(name: string, signal: AbortSignal) {
  return new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => resolve(["ada", "grace"].includes(name)), 600);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
}

const signUp = forms.define({
  schema: SignUp,
  validate: {
    fields: {
      username: {
        // A newer run aborts this one's `signal` and drops its result.
        validate: async (name, { signal }) =>
          (await isTaken(name, signal))
            ? { message: "That name is taken." }
            : undefined,
        // Waits for a pause in typing. Submit skips the wait.
        debounce: 400,
      },
    },
  },
  onSubmit: (value) => value,
});

export default function SignUpForm() {
  const form = useForm(signUp);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="username" label="Username" />
          <form.TextField name="email" label="Email" />
          <button type="submit">Sign up</button>
        </form>
      )}
    </form.Form>
  );
}
