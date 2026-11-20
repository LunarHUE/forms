import { type FieldApi, inputProps } from "@lunarhue/forms-react";

export function TextField({ field, label }: { field: FieldApi<string>; label: string }) {
  return (
    <label>
      {label}
      <input {...inputProps(field)} />
    </label>
  );
}
