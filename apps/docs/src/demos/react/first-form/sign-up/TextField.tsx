import type { FieldApi } from "@lunarhue/forms-react";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// `inputProps()` carries the value, the handlers and the aria attributes
// that point at the error list.
export function TextField({ field, label }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...field.inputProps()} />
      <ul id={field.errorId}>
        {field.shownErrors.map((error) => (
          <li key={error.message}>{error.message}</li>
        ))}
      </ul>
    </div>
  );
}
