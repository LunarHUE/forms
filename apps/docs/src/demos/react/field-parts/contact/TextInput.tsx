import { type FieldApi, inputProps } from "@lunarhue/forms-react";

interface TextInputProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// One plain component. The field types in contact.tsx give it different masks.
export function TextInput({ field, label }: TextInputProps) {
  return (
    <label>
      {label}
      <input {...inputProps(field)} />
      <output>Stored: {JSON.stringify(field.value)}</output>
    </label>
  );
}
