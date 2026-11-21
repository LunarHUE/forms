import { defineField } from "@lunarhue/forms-solid";
import { digits, masked, upper } from "@lunarhue/forms-solid/text";
import { TextInput } from "./TextInput";

// "5551234567" shows as "(555) 123-4567".
function formatPhone(value: string) {
  if (value.length > 6) return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
  if (value.length > 3) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
  return value;
}

// Two field types from one component. Each part travels with its type, so
// any form that registers them gets the masks.
export const PhoneField = defineField(TextInput, masked({ clean: digits, display: formatPhone }));
export const CodeField = defineField(TextInput, masked({ clean: upper, display: (value) => value }));
