import { type FieldApi, inputProps } from "@lunarhue/forms-react";

interface TextInputProps {
  readonly field: FieldApi<string>;
  readonly label: string;
  readonly type?: "text" | "email" | "password";
}

// A plain component that takes the field `form.Field` hands its child.
export function TextInput({ field, label, type = "text" }: TextInputProps) {
  return (
    <div>
      <label htmlFor={field.id}>{label}</label>
      <input {...inputProps(field, { type })} />
      <ul id={field.errorId}>
        {field.shownErrors.map((error) => (
          <li key={error.message}>{error.message}</li>
        ))}
      </ul>
    </div>
  );
}
