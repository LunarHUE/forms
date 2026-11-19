import type { FieldApi } from "@lunarhue/forms-solid";
import { For } from "solid-js";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// `field.id` is the input's id, so the label points at it. `inputProps()`
// sets `aria-describedby` to `field.errorId` while errors show.
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
