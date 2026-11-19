import { type FieldApi, inputProps } from "@lunarhue/forms-solid";

interface PhoneInputProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// A plain input. The mask part on `PhoneField` gives the field its display
// text, so `inputProps` shows the formatted number and keeps the caret where
// the user is typing.
export function PhoneInput(props: PhoneInputProps) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field, { type: "tel" })} />
    </label>
  );
}
