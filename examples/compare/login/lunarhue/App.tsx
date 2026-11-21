import { createForms, type FieldApi, fieldValidators, inputProps, useForm } from "@lunarhue/forms-react/mini";
import { signIn } from "../../shared/server.ts";
import { FieldShell, Page } from "../../shared/ui.tsx";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
  readonly type?: "text" | "email" | "password";
}

function TextField({ field, label, type = "text" }: TextFieldProps) {
  return (
    <FieldShell id={field.id} errorId={field.errorId} label={label} errors={field.shownErrors.map((error) => error.message)}>
      <input {...inputProps(field, { type })} />
    </FieldShell>
  );
}

const forms = createForms({ fields: { TextField } });

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const loginForm = forms.define({
  defaultValues: { email: "", password: "" },
  validate: {
    fields: fieldValidators({
      email: (email) => (emailPattern.test(email) ? undefined : { message: "Enter a valid email." }),
      password: (password) => (password.length >= 8 ? undefined : { message: "Use at least 8 characters." }),
    }),
  },
  onSubmit: async (value, { store }) => {
    const response = await signIn(value);
    if (!response.ok) {
      store.setErrors({ fields: Object.fromEntries(Object.entries(response.errors).map(([name, message]) => [name, { message }])) });
      return undefined;
    }
    return `Signed in as ${value.email}.`;
  },
});

export function App() {
  const form = useForm(loginForm);
  return (
    <Page title="Sign in" lede="Using @lunarhue/forms-react/mini: sync field validation and server errors.">
      <form {...form.formProps}>
        <form.TextField name="email" label="Email" type="email" />
        <form.TextField name="password" label="Password" type="password" />
        <form.State select={(state) => state.submitting}>
          {(submitting) => (
            <div className="actions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </div>
          )}
        </form.State>
        <form.State select={(state) => state.submission}>
          {(submission) => <p role="status">{submission.status === "succeeded" ? submission.result : null}</p>}
        </form.State>
      </form>
    </Page>
  );
}
