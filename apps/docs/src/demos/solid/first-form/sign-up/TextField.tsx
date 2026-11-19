import type { FieldApi } from "@lunarhue/forms-solid";
import { For } from "solid-js";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// Read `props.field` instead of destructuring it, so it stays reactive.
// `inputProps()` carries the value, the handlers and the aria attributes
// that point at the error list.
export function TextField(props: TextFieldProps) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input {...props.field.inputProps()} />
      <ul id={props.field.errorId}>
        <For each={props.field.shownErrors}>{(error) => <li>{error.message}</li>}</For>
      </ul>
    </div>
  );
}
