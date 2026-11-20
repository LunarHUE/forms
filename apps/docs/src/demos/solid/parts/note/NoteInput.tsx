import { type FieldApi, inputProps } from "@lunarhue/forms-solid";

export function NoteInput(props: { field: FieldApi<string>; label: string }) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field)} />
      <output>{props.field.value.length} characters</output>
    </label>
  );
}
