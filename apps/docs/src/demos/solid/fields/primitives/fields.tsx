import type { FieldApi, FormError } from "@lunarhue/forms-solid";
import { For } from "solid-js";

interface FieldProps<T> {
  readonly field: FieldApi<T>;
  readonly label: string;
}

// Plain elements bound the way a primitive library takes a field: its text
// or value, the writes, the blur, and `ref` so an invalid submit can focus
// it. A primitive's own value and change props take the same pieces.
function Errors(props: { readonly id: string; readonly errors: readonly FormError[] }) {
  return (
    <ul id={props.id}>
      <For each={props.errors}>{(error) => <li>{error.message}</li>}</For>
    </ul>
  );
}

export function TextField(props: FieldProps<string>) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input
        id={props.field.id}
        ref={props.field.ref}
        value={props.field.text}
        // The event tells a mask where the caret was.
        onInput={(event) => props.field.setText(event.currentTarget.value, event)}
        onBlur={props.field.handleBlur}
        aria-describedby={props.field.errorId}
      />
      <Errors id={props.field.errorId} errors={props.field.shownErrors} />
    </div>
  );
}

export function NumberField(props: FieldProps<number>) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input
        id={props.field.id}
        inputmode="decimal"
        ref={props.field.ref}
        // Keeps "1." and "-" as typed while the field holds 1 and the value before.
        value={props.field.text}
        onInput={(event) => props.field.setNumberText(event.currentTarget.value)}
        onBlur={props.field.handleBlur}
        aria-describedby={props.field.errorId}
      />
      <Errors id={props.field.errorId} errors={props.field.shownErrors} />
    </div>
  );
}

export function CheckboxField(props: FieldProps<boolean>) {
  return (
    <div>
      <label>
        <input
          type="checkbox"
          ref={props.field.ref}
          checked={props.field.value}
          onChange={(event) => props.field.setValue(event.currentTarget.checked)}
          onBlur={props.field.handleBlur}
          aria-describedby={props.field.errorId}
        />
        {props.label}
      </label>
      <Errors id={props.field.errorId} errors={props.field.shownErrors} />
    </div>
  );
}
