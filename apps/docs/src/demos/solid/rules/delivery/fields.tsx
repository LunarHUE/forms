import { type FieldApi, inputProps } from "@lunarhue/forms-solid";
import { Show } from "solid-js";
import { rules } from "@lunarhue/forms-solid/plugins";

interface FieldProps<V> {
  readonly field: FieldApi<V>;
  readonly label: string;
}

// `inputProps` sets `disabled` from the field. `hidden` is the
// plugin's own meta, so the component reads it.
export function TextField(props: FieldProps<string>) {
  return (
    <Show when={!rules.meta(props.field).hidden}>
      <label>
        {props.label}
        <input {...inputProps(props.field)} />
      </label>
    </Show>
  );
}

export function Checkbox(props: FieldProps<boolean>) {
  return (
    <label>
      <input {...inputProps(props.field, { kind: "checkbox" })} />
      {props.label}
    </label>
  );
}
