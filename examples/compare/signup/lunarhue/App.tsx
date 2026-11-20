import { createForms, debounced, useForm } from "@lunarhue/forms-react";
import { isUsernameTaken, signUp } from "../../shared/server.ts";
import { Page } from "../../shared/ui.tsx";
import { Checkbox, TextField } from "./fields.tsx";

const forms = createForms({ fields: { TextField, Checkbox } });

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validators first run on blur and then on every input, which is the
// default, so nothing here sets it.
const signUpForm = forms.define({
  defaultValues: { email: "", username: "", password: "", confirm: "", terms: false },
  validate: {
    fields: {
      email: (email) => (emailPattern.test(email) ? undefined : { message: "Enter a valid email." }),
      // The sync rules answer at once. Only a well-formed name goes to the
      // server. A newer run aborts the older request.
      username: debounced((name, { signal }) => {
        if (name.length < 3) return { message: "Use at least 3 characters." };
        if (!/^[a-z0-9_]+$/i.test(name)) return { message: "Use letters, digits and underscores." };
        return isUsernameTaken(name, signal).then((taken) => (taken ? { message: "That username is taken." } : undefined));
      }, 400),
      password: (password) => (password.length >= 8 ? undefined : { message: "Use at least 8 characters." }),
      terms: (accepted) => (accepted ? undefined : { message: "Accept the terms to continue." }),
    },
    // Sees the whole value, so it runs again when either password changes.
    form: ({ password, confirm }) => {
      if (confirm === "") return { fields: { confirm: { message: "Confirm your password." } } };
      if (confirm !== password) return { fields: { confirm: { message: "The passwords don't match." } } };
      return undefined;
    },
  },
  onSubmit: async (value, { store }) => {
    const response = await signUp(value);
    if (!response.ok) {
      // Each message lands on its field and clears when the user edits it.
      store.setErrors({ fields: Object.fromEntries(Object.entries(response.errors).map(([name, message]) => [name, { message }])) });
      return undefined;
    }
    return `Welcome, ${value.username}.`;
  },
});

export function App() {
  const form = useForm(signUpForm);
  return (
    <Page title="Create an account" lede="Core only: field validators, a cross-field check, an async check and server errors.">
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="email" label="Email" type="email" />
            <form.TextField name="username" label="Username" />
            <form.TextField name="password" label="Password" type="password" />
            <form.TextField name="confirm" label="Confirm password" type="password" />
            <form.Checkbox name="terms" label="I accept the terms" />
            <form.State select={(state) => state.submitting}>
              {(submitting) => (
                <div className="actions">
                  <button type="submit" disabled={submitting}>
                    {submitting ? "Creating account..." : "Create account"}
                  </button>
                </div>
              )}
            </form.State>
            <form.State select={(state) => state.submission}>
              {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
            </form.State>
          </form>
        )}
      </form.Form>
    </Page>
  );
}
