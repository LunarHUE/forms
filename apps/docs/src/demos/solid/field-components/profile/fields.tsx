import { checkboxProps, type FieldApi, type FormError, inputProps, numberProps } from "@lunarhue/forms-solid";
import { For } from "solid-js";

function Errors(props: { readonly id: string; readonly errors: readonly FormError[] }) {
  return (
    <ul id={props.id}>
      <For each={props.errors}>{(error) => <li>{error.message}</li>}</For>
    </ul>
  );
}

// `undefined` in the type lets it take optional string fields too.
export function TextField(props: { field: FieldApi<string | undefined>; label: string }) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input {...inputProps(props.field)} />
      <Errors id={props.field.errorId} errors={props.field.shownErrors} />
    </div>
  );
}

// Only number fields fit, so `<form.NumberField name="name" />` is a type error.
export function NumberField(props: { field: FieldApi<number>; label: string }) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <input {...numberProps(props.field)} />
      <Errors id={props.field.errorId} errors={props.field.shownErrors} />
    </div>
  );
}

export function CheckboxField(props: { field: FieldApi<boolean>; label: string }) {
  return (
    <div>
      <label>
        <input {...checkboxProps(props.field)} />
        {props.label}
      </label>
      <Errors id={props.field.errorId} errors={props.field.shownErrors} />
    </div>
  );
}
