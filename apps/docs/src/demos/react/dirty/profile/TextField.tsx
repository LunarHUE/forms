import type { FieldApi } from "@lunarhue/forms-react";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// `field.dirty` is true while the value differs from its baseline.
export function TextField({ field, label }: TextFieldProps) {
  return (
    <label>
      <span>
        {label}
        {field.dirty ? " (changed)" : null}
      </span>
      <input {...field.inputProps()} />
    </label>
  );
}
