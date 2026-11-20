import { type FieldApi, inputProps } from "@lunarhue/forms-solid";
import { For } from "solid-js";

interface TextInputProps {
  readonly field: FieldApi<string>;
  readonly label: string;
  readonly type?: "text" | "email" | "password";
}

// A plain component that takes the field `form.Field` hands its child.
// Read it through `props`: destructuring stops it updating.
export function TextInput(props: TextInputProps) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input {...inputProps(props.field, { type: props.type ?? "text" })} />
      <ul id={props.field.errorId}>
        <For each={props.field.shownErrors}>{(error) => <li>{error.message}</li>}</For>
      </ul>
    </div>
  );
}
