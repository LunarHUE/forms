import { type FieldApi, inputProps } from "@lunarhue/forms-solid";
import { For } from "solid-js";

interface NumberFieldProps {
  readonly field: FieldApi<number>;
  readonly label: string;
}

// `kind: "number"` gives the props of a number input. It only type-checks
// on a number field.
export function NumberField(props: NumberFieldProps) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input {...inputProps(props.field, { kind: "number" })} />
      <ul id={props.field.errorId}>
        <For each={props.field.shownErrors}>{(error) => <li>{error.message}</li>}</For>
      </ul>
    </div>
  );
}
