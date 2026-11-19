import { type FieldApi, type FormError, inputProps } from "@lunarhue/forms-solid";

interface TextFieldProps {
  readonly field: FieldApi<string, FormError, "dirty">;
  readonly label: string;
}

// `field.dirty` is true while the value differs from its baseline. The
// "dirty" in the type says the form must have `dirty()`.
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
