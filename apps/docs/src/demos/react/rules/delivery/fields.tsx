import type { FieldApi } from "@lunarhue/forms-react";
import { orderRules } from "./rules";

interface FieldProps<V> {
  readonly field: FieldApi<V>;
  readonly label: string;
}

// `inputProps()` sets `disabled` from the field. `hidden` is the
// plugin's own meta, so the component reads it.
export function TextField({ field, label }: FieldProps<string>) {
  if (orderRules.meta(field).hidden) return null;
  return (
    <label>
      {label}
      <input {...field.inputProps()} />
    </label>
  );
}

export function Checkbox({ field, label }: FieldProps<boolean>) {
  return (
    <label>
      <input {...field.inputProps({ kind: "checkbox" })} />
      {label}
    </label>
  );
}
