import { type Choice, type FieldApi, type FormError, inputProps } from "@lunarhue/forms-react";
import { rules } from "@lunarhue/forms-react/plugins";
import type { HTMLAttributes } from "react";
import { CheckShell, FieldShell } from "../../shared/ui.tsx";

// Each component reads `field.dirty`, so it fits only forms with dirty().
type DirtyField<V> = FieldApi<V, FormError, "dirty">;

const messages = (field: { readonly shownErrors: readonly FormError[] }) => field.shownErrors.map((error) => error.message);

interface TextProps {
  readonly field: DirtyField<string>;
  readonly label: string;
}

// A rule can hide the text fields, so they read the rules meta. A field
// no rule names reads `{ hidden: false }`.
export function TextField({ field, label }: TextProps) {
  if (rules.meta(field).hidden) return null;
  return (
    <FieldShell id={field.id} errorId={field.errorId} label={label} errors={messages(field)} changed={field.dirty}>
      <input {...inputProps(field)} />
    </FieldShell>
  );
}

export function TextArea({ field, label }: TextProps) {
  if (rules.meta(field).hidden) return null;
  return (
    <FieldShell id={field.id} errorId={field.errorId} label={label} errors={messages(field)} changed={field.dirty}>
      <textarea rows={3} {...inputProps(field, { kind: "textarea" })} />
    </FieldShell>
  );
}

/**
 * The input behind every masked field type in forms.ts. The `masked` part
 * on the type cleans the value and gives the display text, so this stays a
 * plain input.
 */
export function MaskedInput({ field, label, inputMode }: TextProps & { readonly inputMode: HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return (
    <FieldShell id={field.id} errorId={field.errorId} label={label} errors={messages(field)} changed={field.dirty}>
      <input {...inputProps(field)} inputMode={inputMode} />
    </FieldShell>
  );
}

interface SelectProps {
  readonly field: DirtyField<Choice>;
  readonly label: string;
  readonly options: readonly Choice[];
}

export function Select({ field, label, options }: SelectProps) {
  return (
    <FieldShell id={field.id} errorId={field.errorId} label={label} errors={messages(field)} changed={field.dirty}>
      <select {...inputProps(field, { kind: "select" })}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Checkbox({ field, label }: { readonly field: DirtyField<boolean>; readonly label: string }) {
  return (
    <CheckShell errorId={field.errorId} errors={messages(field)} changed={field.dirty}>
      <input {...inputProps(field, { kind: "checkbox" })} />
      {label}
    </CheckShell>
  );
}
