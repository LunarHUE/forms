import { defineField, type FieldApi, inputProps } from "@lunarhue/forms-solid";
import { digits, masked } from "@lunarhue/forms-solid/text";

// "5551234567" shows as "(555) 123-4567".
function formatPhone(value: string) {
  const area = value.slice(0, 3);
  const prefix = value.slice(3, 6);
  const line = value.slice(6, 10);
  if (value.length > 6) return `(${area}) ${prefix}-${line}`;
  if (value.length > 3) return `(${area}) ${prefix}`;
  return area;
}

interface PhoneInputProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// A plain input. The mask part gives the field its display text, so
// `inputProps` shows the formatted number and keeps the caret where the user
// is typing.
function PhoneInput(props: PhoneInputProps) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field, { type: "tel" })} />
    </label>
  );
}

// The input and its mask as one field type. Register it on any `createForms`,
// and every field it renders stores digits and shows them formatted. The
// mask needs no plugin.
export const PhoneField = defineField(PhoneInput, masked({ clean: digits, display: formatPhone }));
