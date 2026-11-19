import type { FieldApi } from "@lunarhue/forms-react";

interface PhoneFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// The mask gives the field its display text, so `inputProps` shows the
// formatted number and keeps the caret where the user is typing.
export function PhoneField({ field, label }: PhoneFieldProps) {
  return (
    <label>
      {label}
      <input {...field.inputProps({ type: "tel" })} />
    </label>
  );
}
