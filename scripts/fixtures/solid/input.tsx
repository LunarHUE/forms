import type { FieldApi } from "@lunarhue/forms-solid";

interface TextInputProps {
  readonly field: FieldApi<string>;
}

/** A text input bound by hand, with no `inputProps`. */
export function TextInput(props: TextInputProps) {
  return (
    <input
      id={props.field.id}
      name={props.field.name}
      value={props.field.value}
      onInput={(event) => props.field.setValue(event.currentTarget.value)}
      onBlur={() => props.field.handleBlur()}
    />
  );
}

interface TextFieldProps extends TextInputProps {
  readonly label: string;
}

/** The same input as a field component, registered through `createForms({ fields })`. */
export function TextField(props: TextFieldProps) {
  return (
    <div>
      <label for={props.field.id}>{props.label}</label>
      <TextInput field={props.field} />
      <p id={props.field.errorId}>{props.field.shownErrors[0]?.message}</p>
    </div>
  );
}
