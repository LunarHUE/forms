import { useForm, useStore } from "@tanstack/react-form";
import { useId, useState } from "react";
import { signIn } from "../../shared/server.ts";
import { FieldShell, Page } from "../../shared/ui.tsx";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function checkEmail({ value }: { value: string }) {
  return emailPattern.test(value) ? undefined : "Enter a valid email.";
}

function checkPassword({ value }: { value: string }) {
  return value.length >= 8 ? undefined : "Use at least 8 characters.";
}

export function App() {
  const emailId = useId();
  const passwordId = useId();
  const [status, setStatus] = useState("");
  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: {
      onSubmitAsync: async ({ value }) => {
        const response = await signIn(value);
        return response.ok ? undefined : { fields: response.errors };
      },
    },
    onSubmit: ({ value }) => setStatus(`Signed in as ${value.email}.`),
  });
  const submitted = useStore(form.store, (state) => state.submissionAttempts > 0);

  return (
    <Page title="Sign in" lede="Using @lunarhue/forms-react/mini: sync field validation and server errors.">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="email" validators={{ onChange: checkEmail }}>
          {(field) => {
            const errors =
              field.state.meta.isBlurred || submitted
                ? field.state.meta.errors.filter((error): error is string => typeof error === "string")
                : [];
            const errorId = `${emailId}-errors`;
            return (
              <FieldShell id={emailId} errorId={errorId} label="Email" errors={errors}>
                <input
                  id={emailId}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={() => {
                    field.handleBlur();
                    void field.validate("change");
                  }}
                  aria-invalid={errors.length > 0 ? true : undefined}
                  aria-describedby={errors.length > 0 ? errorId : undefined}
                />
              </FieldShell>
            );
          }}
        </form.Field>
        <form.Field name="password" validators={{ onChange: checkPassword }}>
          {(field) => {
            const errors =
              field.state.meta.isBlurred || submitted
                ? field.state.meta.errors.filter((error): error is string => typeof error === "string")
                : [];
            const errorId = `${passwordId}-errors`;
            return (
              <FieldShell id={passwordId} errorId={errorId} label="Password" errors={errors}>
                <input
                  id={passwordId}
                  name={field.name}
                  type="password"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={() => {
                    field.handleBlur();
                    void field.validate("change");
                  }}
                  aria-invalid={errors.length > 0 ? true : undefined}
                  aria-describedby={errors.length > 0 ? errorId : undefined}
                />
              </FieldShell>
            );
          }}
        </form.Field>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <div className="actions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </div>
          )}
        </form.Subscribe>
        <p role="status">{status}</p>
      </form>
    </Page>
  );
}
