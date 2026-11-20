import { type FieldApi, inputProps } from "@lunarhue/forms-solid";

export function TextField(props: { field: FieldApi<string>; label: string }) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field)} />
    </label>
  );
}
