import type { FieldApi } from "@lunarhue/forms-solid";
import { For, Show } from "solid-js";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// `shownErrors` is empty until the field is touched or the form submitted.
export function TextField(props: TextFieldProps) {
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps()} />
      <Show when={props.field.validating}>
        <span>Checking...</span>
      </Show>
      <ul id={props.field.errorId}>
        <For each={props.field.shownErrors}>{(error) => <li>{error.message}</li>}</For>
      </ul>
    </label>
  );
}
