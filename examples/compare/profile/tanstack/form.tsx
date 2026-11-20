// The app's form hook and field components. Each component marks itself
// changed while its value differs from the form's default values.
import { createFormHook, createFormHookContexts, useStore } from "@tanstack/react-form";
import { useId } from "react";
import { CheckShell, FieldShell } from "../../shared/ui.tsx";

const { fieldContext, formContext, useFieldContext } = createFormHookContexts();

/**
 * What every field component needs: ids, the errors to show and the changed
 * mark. Errors wait for a blur or a submit, as `isTouched` turns true on the
 * first keystroke. `isDirty` stays true once the user types, so the mark
 * reads `isDefaultValue`, which turns back when the user types the original.
 */
function useFieldView() {
  const field = useFieldContext<unknown>();
  const id = useId();
  const submitted = useStore(field.form.store, (state) => state.submissionAttempts > 0);
  const { isBlurred, errors, isDefaultValue } = field.state.meta;
  const shown = isBlurred || submitted ? errors.map(messageOf) : [];
  return {
    id,
    errorId: `${id}-errors`,
    errors: shown,
    changed: !isDefaultValue,
    aria: {
      "aria-invalid": shown.length > 0 ? true : undefined,
      "aria-describedby": shown.length > 0 ? `${id}-errors` : undefined,
    },
  };
}

/** Schema issues arrive as objects, function validators' errors as strings. */
function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  return String(error);
}

function TextField({ label }: { readonly label: string }) {
  const field = useFieldContext<string>();
  const view = useFieldView();
  return (
    <FieldShell id={view.id} errorId={view.errorId} label={label} errors={view.errors} changed={view.changed}>
      <input
        id={view.id}
        name={field.name}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        {...view.aria}
      />
    </FieldShell>
  );
}

function TextArea({ label }: { readonly label: string }) {
  const field = useFieldContext<string>();
  const view = useFieldView();
  return (
    <FieldShell id={view.id} errorId={view.errorId} label={label} errors={view.errors} changed={view.changed}>
      <textarea
        id={view.id}
        rows={3}
        name={field.name}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        {...view.aria}
      />
    </FieldShell>
  );
}

/**
 * A select over the field's options. TanStack's field context has no way to
 * tie `options` to the field's value type, so the component takes strings
 * and the caller passes the field's own list.
 */
function Select({ label, options }: { readonly label: string; readonly options: readonly string[] }) {
  const field = useFieldContext<string>();
  const view = useFieldView();
  return (
    <FieldShell id={view.id} errorId={view.errorId} label={label} errors={view.errors} changed={view.changed}>
      <select
        id={view.id}
        name={field.name}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        {...view.aria}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function Checkbox({ label }: { readonly label: string }) {
  const field = useFieldContext<boolean>();
  const view = useFieldView();
  return (
    <CheckShell errorId={view.errorId} errors={view.errors} changed={view.changed}>
      <input
        type="checkbox"
        name={field.name}
        checked={field.state.value}
        onChange={(event) => field.handleChange(event.target.checked)}
        onBlur={field.handleBlur}
        {...view.aria}
      />
      {label}
    </CheckShell>
  );
}

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, TextArea, Select, Checkbox },
  formComponents: {},
});
