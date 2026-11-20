import { type FieldApi, inputProps } from "@lunarhue/forms-react";

interface NoteInputProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

export function NoteInput({ field, label }: NoteInputProps) {
  return (
    <label>
      {label}
      <input {...inputProps(field)} />
      <output>{field.value.length} characters</output>
    </label>
  );
}
