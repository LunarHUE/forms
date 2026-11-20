import { checkboxProps, type FieldApi, type FormError, inputProps, numberProps } from "@lunarhue/forms-react";

function Errors({ id, errors }: { readonly id: string; readonly errors: readonly FormError[] }) {
  return (
    <ul id={id}>
      {errors.map((error) => (
        <li key={error.message}>{error.message}</li>
      ))}
    </ul>
  );
}

// `undefined` in the type lets it take optional string fields too.
export function TextField({ field, label }: { field: FieldApi<string | undefined>; label: string }) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...inputProps(field)} />
      <Errors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}

// Only number fields fit, so `<form.NumberField name="name" />` is a type error.
export function NumberField({ field, label }: { field: FieldApi<number>; label: string }) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...numberProps(field)} />
      <Errors id={field.errorId} errors={field.shownErrors} />
    </div>
  );
}

export function CheckboxField({ field, label }: { field: FieldApi<boolean>; label: string }) {
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
