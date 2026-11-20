import { type FieldApi, inputProps } from "@lunarhue/forms-react";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

export function TextField({ field, label }: TextFieldProps) {
  return (
    <label>
      {label}
      <input {...inputProps(field)} />
    </label>
  );
}
