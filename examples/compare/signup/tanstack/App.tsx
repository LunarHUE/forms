import { useState } from "react";
import { isUsernameTaken, signUp } from "../../shared/server.ts";
import { Page } from "../../shared/ui.tsx";
import { useAppForm } from "./form.tsx";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Each check runs on every change and on blur (see useBlur in form.tsx).
// The field components show errors only once the field is blurred.
function checkEmail({ value }: { value: string }) {
  return emailPattern.test(value) ? undefined : "Enter a valid email.";
}

function checkUsername({ value }: { value: string }) {
  if (value.length < 3) return "Use at least 3 characters.";
  if (!/^[a-z0-9_]+$/i.test(value)) return "Use letters, digits and underscores.";
  return undefined;
}

async function checkUsernameFree({ value, signal }: { value: string; signal: AbortSignal }) {
  return (await isUsernameTaken(value, signal)) ? "That username is taken." : undefined;
}

function checkPassword({ value }: { value: string }) {
  return value.length >= 8 ? undefined : "Use at least 8 characters.";
}

function checkTerms({ value }: { value: boolean }) {
  return value ? undefined : "Accept the terms to continue.";
}

export function App() {
  const [welcome, setWelcome] = useState("");
  const form = useAppForm({
    defaultValues: { email: "", username: "", password: "", confirm: "", terms: false },
    validators: {
      // The request runs as a submit validator, so a refusal puts its
      // messages on the fields and onSubmit doesn't run.
      onSubmitAsync: async ({ value }) => {
        const response = await signUp(value);
        return response.ok ? undefined : { fields: response.errors };
      },
    },
    onSubmit: ({ value }) => setWelcome(`Welcome, ${value.username}.`),
  });

  return (
    <Page title="Create an account" lede="Core only: field validators, a cross-field check, an async check and server errors.">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.AppField name="email" validators={{ onChange: checkEmail }}>
          {(field) => <field.TextField label="Email" type="email" />}
        </form.AppField>
        <form.AppField
          name="username"
          validators={{
            onChange: checkUsername,
            // Runs only when the sync check passes. Waits for a pause in
            // typing, and asks the server only after the first blur, since
            // nothing shows before it.
            onChangeAsyncDebounceMs: 400,
            onChangeAsync: async (props) => (props.fieldApi.state.meta.isBlurred ? checkUsernameFree(props) : undefined),
          }}
        >
          {(field) => <field.TextField label="Username" />}
        </form.AppField>
        <form.AppField name="password" validators={{ onChange: checkPassword }}>
          {(field) => <field.TextField label="Password" type="password" />}
        </form.AppField>
        <form.AppField
          name="confirm"
          validators={{
            // Runs again when the password changes.
            onChangeListenTo: ["password"],
            onChange: ({ value, fieldApi }) => checkConfirm(value, fieldApi.form.getFieldValue("password")),
          }}
        >
          {(field) => <field.TextField label="Confirm password" type="password" />}
        </form.AppField>
        <form.AppField name="terms" validators={{ onChange: checkTerms }}>
          {(field) => <field.Checkbox label="I accept the terms" />}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton label="Create account" busyLabel="Creating account..." />
        </form.AppForm>
        <p role="status">{welcome}</p>
      </form>
    </Page>
  );
}

function checkConfirm(confirm: string, password: string) {
  if (confirm === "") return "Confirm your password.";
  if (confirm !== password) return "The passwords don't match.";
  return undefined;
}
