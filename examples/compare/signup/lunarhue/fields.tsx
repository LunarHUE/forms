import { type FieldApi, inputProps, type TextInputType } from "@lunarhue/forms-react";
import { CheckShell, FieldShell } from "../../shared/ui.tsx";

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
  readonly type?: TextInputType;
}

export function TextField({ field, label, type = "text" }: TextFieldProps) {
  return (
    <FieldShell
      id={field.id}
      errorId={field.errorId}
      label={label}
      errors={field.shownErrors.map((error) => error.message)}
      checking={field.validating}
    >
      <input {...inputProps(field, { type })} />
    </FieldShell>
  );
}

interface CheckboxProps {
  readonly field: FieldApi<boolean>;
  readonly label: string;
}

export function Checkbox({ field, label }: CheckboxProps) {
  return (
    <CheckShell errorId={field.errorId} errors={field.shownErrors.map((error) => error.message)}>
      <input {...inputProps(field, { kind: "checkbox" })} />
      {label}
    </CheckShell>
  );
}
