import { type FieldApi, type FormError, inputProps } from "@lunarhue/forms-react";

// Reads `dirty`, so it says it needs dirty(). It fits only forms that have it.
export function TextField({ field, label }: { field: FieldApi<string, FormError, "dirty">; label: string }) {
  return (
    <label>
      {field.dirty ? `${label} (changed)` : label}
      <input {...inputProps(field)} />
    </label>
  );
}
