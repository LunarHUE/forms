// The app's form hook. TanStack Form registers field components through
// createFormHook, and each component reads its field from context.
import { createFormHook, createFormHookContexts, useStore } from "@tanstack/react-form";
import { useId } from "react";
import { CheckShell, FieldShell } from "../../shared/ui.tsx";

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

/**
 * The messages to show: none until the field is blurred or the form
 * submitted. TanStack sets `isTouched` on the first keystroke, so this reads
 * `isBlurred` to wait for the blur.
 */
function useShownErrors(): string[] {
  const field = useFieldContext<unknown>();
  const submitted = useStore(field.form.store, (state) => state.submissionAttempts > 0);
  const { isBlurred, errors } = field.state.meta;
  if (!isBlurred && !submitted) return [];
  return errors.filter((error): error is string => typeof error === "string");
}

interface TextFieldProps {
  readonly label: string;
  readonly type?: "text" | "email" | "password";
}

/**
 * Marks the field blurred and runs its change validators. The forms list
 * their checks under `onChange` only: an `onBlur` error would stay until the
 * next blur, even after the user fixed the value.
 */
function useBlur() {
  const field = useFieldContext<unknown>();
  return () => {
    field.handleBlur();
    void field.validate("change");
  };
}

function TextField({ label, type = "text" }: TextFieldProps) {
  const field = useFieldContext<string>();
  const id = useId();
  const errorId = `${id}-errors`;
  const errors = useShownErrors();
  const onBlur = useBlur();
  return (
    <FieldShell
      id={id}
      errorId={errorId}
      label={label}
      errors={errors}
      checking={field.state.meta.isValidating}
    >
      <input
        id={id}
        name={field.name}
        type={type}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={onBlur}
        aria-invalid={errors.length > 0 ? true : undefined}
        aria-describedby={errors.length > 0 ? errorId : undefined}
      />
    </FieldShell>
  );
}

function Checkbox({ label }: { readonly label: string }) {
  const field = useFieldContext<boolean>();
  const errorId = `${useId()}-errors`;
  const errors = useShownErrors();
  const onBlur = useBlur();
  return (
    <CheckShell errorId={errorId} errors={errors}>
      <input
        type="checkbox"
        name={field.name}
        checked={field.state.value}
        onChange={(event) => field.handleChange(event.target.checked)}
        onBlur={onBlur}
        aria-invalid={errors.length > 0 ? true : undefined}
        aria-describedby={errors.length > 0 ? errorId : undefined}
      />
      {label}
    </CheckShell>
  );
}

/**
 * TanStack ignores a submit while a check is pending, a debounce included,
 * so the button follows `canSubmit` and stays disabled until checks settle.
 * That also disables it while a touched form is invalid.
 */
function SubmitButton({ label, busyLabel }: { readonly label: string; readonly busyLabel: string }) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
      {([canSubmit, submitting]) => (
        <div className="actions">
          <button type="submit" disabled={!canSubmit}>
            {submitting ? busyLabel : label}
          </button>
        </div>
      )}
    </form.Subscribe>
  );
}

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, Checkbox },
  formComponents: { SubmitButton },
});
