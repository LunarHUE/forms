import type { FieldApi } from "@lunarhue/forms-solid";

// Each field prints what the store holds under the input.

export function NumberField(props: { field: FieldApi<number>; label: string }) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input {...props.field.inputProps({ kind: "number" })} />
      <output>Stored: {JSON.stringify(props.field.value) ?? "undefined"}</output>
    </div>
  );
}

export function PhoneField(props: { field: FieldApi<string>; label: string }) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input {...props.field.inputProps({ type: "tel" })} />
      <output>Stored: {JSON.stringify(props.field.value)}</output>
    </div>
  );
}
