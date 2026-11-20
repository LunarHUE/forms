import { checkboxProps, type FieldApi, type FormError, inputProps, numberProps } from "@lunarhue/forms-react";

interface ErrorsProps {
  readonly id: string;
  readonly errors: readonly FormError[];
}

function Errors({ id, errors }: ErrorsProps) {
  return (
    <ul id={id}>
      {errors.map((error) => (
        <li key={error.message}>{error.message}</li>
      ))}
    </ul>
  );
}

interface FieldProps<T> {
  readonly field: FieldApi<T>;
  readonly label: string;
}

// `undefined` in the type lets it take optional string fields too.
export function TextField({ field, label }: FieldProps<string | undefined>) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...inputProps(field)} />
      <Errors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}

// Only number fields fit, so `<form.NumberField name="name" />` is a type error.
export function NumberField({ field, label }: FieldProps<number>) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...numberProps(field)} />
      <Errors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}

export function CheckboxField({ field, label }: FieldProps<boolean>) {
  return (
    <div>
      <label>
        <input {...checkboxProps(field)} />
        {label}
      </label>
      <Errors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}
