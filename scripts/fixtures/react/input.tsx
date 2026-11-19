import type { FieldApi } from "@lunarhue/forms-react";

interface TextInputProps {
  readonly field: FieldApi<string>;
}

/** A text input bound by hand, with no `inputProps`. */
export function TextInput({ field }: TextInputProps) {
  return (
    <input
      id={field.id}
      name={field.name}
      value={field.value}
      onChange={(event) => field.setValue(event.target.value)}
      onBlur={() => field.handleBlur()}
    />
  );
}

interface TextFieldProps extends TextInputProps {
  readonly label: string;
}

/** The same input as a field component, registered through `createForms({ fields })`. */
export function TextField({ field, label }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <TextInput field={field} />
      <p id={field.errorId}>{field.shownErrors[0]?.message}</p>
    </div>
  );
}
