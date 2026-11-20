import { type FieldApi, type FormError, inputProps } from "@lunarhue/forms-solid";

interface TextFieldProps {
  readonly field: FieldApi<string, FormError, "dirty">;
  readonly label: string;
}

// Reads `dirty`, so it says it needs dirty(). It fits only forms that have it.
export function TextField(props: TextFieldProps) {
  return (
    <label>
      {props.field.dirty ? `${props.label} (changed)` : props.label}
      <input {...inputProps(props.field)} />
    </label>
  );
}
