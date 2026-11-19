import { type FieldApi, inputProps } from "@lunarhue/forms-solid";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// `field.dirty` is true while the value differs from its baseline.
export function TextField(props: TextFieldProps) {
  return (
    <label>
      <span>
        {props.label}
        {props.field.dirty ? " (changed)" : null}
      </span>
      <input {...inputProps(props.field)} />
    </label>
  );
}
