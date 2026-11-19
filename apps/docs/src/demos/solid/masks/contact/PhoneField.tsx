import { type FieldApi, inputProps } from "@lunarhue/forms-solid";

interface PhoneFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// The mask gives the field its display text, so `inputProps` shows the
// formatted number and keeps the caret where the user is typing.
export function PhoneField(props: PhoneFieldProps) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field, { type: "tel" })} />
    </label>
  );
}
