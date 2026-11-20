import { checkboxProps, type Choice, type FieldApi, type FormError, inputProps, selectProps, textareaProps } from "@lunarhue/forms-react";
import { CheckShell, FieldShell } from "../../shared/ui.tsx";

// Each component reads `field.dirty`, so its type names the plugin: it fits
// only forms with dirty().
type DirtyField<V> = FieldApi<V, FormError, "dirty">;

const messages = (field: { readonly shownErrors: readonly FormError[] }) => field.shownErrors.map((error) => error.message);

export function TextField({ field, label }: { readonly field: DirtyField<string>; readonly label: string }) {
  return (
    <FieldShell id={field.id} errorId={field.errorId} label={label} errors={messages(field)} changed={field.dirty}>
      <input {...inputProps(field)} />
    </FieldShell>
  );
}

export function TextArea({ field, label }: { readonly field: DirtyField<string>; readonly label: string }) {
  return (
    <FieldShell id={field.id} errorId={field.errorId} label={label} errors={messages(field)} changed={field.dirty}>
      <textarea rows={3} {...textareaProps(field)} />
    </FieldShell>
  );
}

// `Choice` stands for the field's own options, so on the time zone field
// `options` takes only the zones the schema lists.
interface SelectProps {
  readonly field: DirtyField<Choice>;
  readonly label: string;
  readonly options: readonly Choice[];
}

export function Select({ field, label, options }: SelectProps) {
  return (
    <FieldShell id={field.id} errorId={field.errorId} label={label} errors={messages(field)} changed={field.dirty}>
      <select {...selectProps(field)}>
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
      <input {...checkboxProps(field)} />
      {label}
    </CheckShell>
  );
}
