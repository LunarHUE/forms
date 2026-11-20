import { type FieldApi, inputProps } from "@lunarhue/forms-react";

export function NoteInput({ field, label }: { field: FieldApi<string>; label: string }) {
  return (
    <label>
      {label}
      <input {...inputProps(field)} />
      <output>{field.value.length} characters</output>
    </label>
  );
}
