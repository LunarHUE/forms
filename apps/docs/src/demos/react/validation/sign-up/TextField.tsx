import { type FieldApi, inputProps } from "@lunarhue/forms-react";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// `shownErrors` is empty until the field is touched or the form submitted.
export function TextField({ field, label }: TextFieldProps) {
  return (
    <label>
      {label}
      <input {...inputProps(field)} />
      {field.validating ? <span>Checking...</span> : null}
      <ul id={field.errorId}>
        {field.shownErrors.map((error) => (
          <li key={error.message}>{error.message}</li>
        ))}
      </ul>
    </label>
  );
}
