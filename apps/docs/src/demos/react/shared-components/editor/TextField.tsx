import { type FieldApi, inputProps } from "@lunarhue/forms-react";
import type { dirty } from "@lunarhue/forms-react/plugins";

interface TextFieldProps {
  readonly field: FieldApi<string, typeof dirty>;
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
