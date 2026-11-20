import { type FieldApi, inputProps } from "@lunarhue/forms-solid";

interface NoteInputProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

export function NoteInput(props: NoteInputProps) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field)} />
      <output>{props.field.value.length} characters</output>
    </label>
  );
}
