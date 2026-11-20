import { type FieldApi, inputProps } from "@lunarhue/forms-solid";

interface TextInputProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// One plain component. The field types in fields.ts give it different masks.
export function TextInput(props: TextInputProps) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field)} />
      <output>Stored: {JSON.stringify(props.field.value)}</output>
    </label>
  );
}
