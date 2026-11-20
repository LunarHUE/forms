import { type FieldApi, type FormError, inputProps } from "@lunarhue/forms-solid";

// Reads `dirty`, so it says it needs dirty(). It fits only forms that have it.
export function TextField(props: { field: FieldApi<string, FormError, "dirty">; label: string }) {
  return (
    <label>
      {props.field.dirty ? `${props.label} (changed)` : props.label}
      <input {...inputProps(props.field)} />
    </label>
  );
}
