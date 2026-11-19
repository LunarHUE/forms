import { type FieldApi, inputProps } from "@lunarhue/forms-react";

interface PhoneInputProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// A plain input. The mask part on `PhoneField` gives the field its display
// text, so `inputProps` shows the formatted number and keeps the caret where
// the user is typing.
export function PhoneInput({ field, label }: PhoneInputProps) {
  return (
    <label>
      {label}
      <input {...inputProps(field, { type: "tel" })} />
    </label>
  );
}
