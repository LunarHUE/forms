import { type FieldApi, inputProps } from "@lunarhue/forms-react";
import type { dirty } from "@lunarhue/forms-react/plugins";

interface TextFieldProps {
  readonly field: FieldApi<string, typeof dirty>;
  readonly label: string;
}

// `field.dirty` is true while the value differs from its baseline. The
// "dirty" in the type says the form must have `dirty()`.
export function TextField({ field, label }: TextFieldProps) {
  return (
    <label>
      <span>
        {label}
        {field.dirty ? " (changed)" : null}
      </span>
      <input {...inputProps(field)} />
    </label>
  );
}
