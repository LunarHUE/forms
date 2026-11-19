import type { FieldApi } from "@lunarhue/forms-solid";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

export function TextField(props: TextFieldProps) {
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps()} />
    </label>
  );
}
