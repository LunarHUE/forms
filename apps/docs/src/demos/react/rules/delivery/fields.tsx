import { type FieldApi, inputProps } from "@lunarhue/forms-react";
import { orderRules } from "./rules";

interface FieldProps<V> {
  readonly field: FieldApi<V>;
  readonly label: string;
}

// `inputProps` sets `disabled` from the field. `hidden` is the
// plugin's own meta, so the component reads it.
export function TextField({ field, label }: FieldProps<string>) {
  if (orderRules.meta(field).hidden) return null;
  return (
    <label>
      {label}
      <input {...inputProps(field)} />
    </label>
  );
}

export function Checkbox({ field, label }: FieldProps<boolean>) {
  return (
    <label>
      <input {...inputProps(field, { kind: "checkbox" })} />
      {label}
    </label>
  );
}
