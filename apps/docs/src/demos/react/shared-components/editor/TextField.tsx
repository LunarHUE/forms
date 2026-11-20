import { type FieldApi, type FormError, inputProps } from "@lunarhue/forms-react";

interface TextFieldProps {
  readonly field: FieldApi<string, FormError, "dirty">;
  readonly label: string;
}

// Reads `dirty`, so it says it needs dirty(). It fits only forms that have it.
export function TextField({ field, label }: TextFieldProps) {
  return (
    <label>
      {field.dirty ? `${label} (changed)` : label}
      <input {...inputProps(field)} />
    </label>
  );
}
