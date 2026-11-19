import type { FieldApi } from "@lunarhue/forms-react";

// Each field prints what the store holds under the input.

export function NumberField({ field, label }: { field: FieldApi<number>; label: string }) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...field.inputProps({ kind: "number" })} />
      <output>Stored: {JSON.stringify(field.value) ?? "undefined"}</output>
    </div>
  );
}

export function PhoneField({ field, label }: { field: FieldApi<string>; label: string }) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...field.inputProps({ type: "tel" })} />
      <output>Stored: {JSON.stringify(field.value)}</output>
    </div>
  );
}
