import { type FieldApi, inputProps } from "@lunarhue/forms-react";

interface NumberFieldProps {
  readonly field: FieldApi<number>;
  readonly label: string;
}

// `kind: "number"` gives the props of a number input. It only type-checks
// on a number field.
export function NumberField({ field, label }: NumberFieldProps) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...inputProps(field, { kind: "number" })} />
      <ul id={field.errorId}>
        {field.shownErrors.map((error) => (
          <li key={error.message}>{error.message}</li>
        ))}
      </ul>
    </div>
  );
}
