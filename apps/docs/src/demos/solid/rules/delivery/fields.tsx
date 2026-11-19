import type { FieldApi } from "@lunarhue/forms-solid";
import { Show } from "solid-js";
import { orderRules } from "./rules";

interface FieldProps<V> {
  readonly field: FieldApi<V>;
  readonly label: string;
}

// `inputProps()` sets `disabled` from the field. `hidden` is the
// plugin's own meta, so the component reads it.
export function TextField(props: FieldProps<string>) {
  return (
    <Show when={!orderRules.meta(props.field).hidden}>
      <label>
        {props.label}
        <input {...props.field.inputProps()} />
      </label>
    </Show>
  );
}

export function Checkbox(props: FieldProps<boolean>) {
  return (
    <label>
      <input {...props.field.inputProps({ kind: "checkbox" })} />
      {props.label}
    </label>
  );
}
