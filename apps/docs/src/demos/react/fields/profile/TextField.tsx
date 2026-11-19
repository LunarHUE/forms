import type { FieldApi } from "@lunarhue/forms-react";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// `field.id` is the input's id, so the label points at it. `inputProps()`
// sets `aria-describedby` to `field.errorId` while errors show.
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
