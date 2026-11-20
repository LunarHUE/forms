import { Checkbox } from "@base-ui/react/checkbox";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { type FieldApi, type FormError, numberPieces } from "@lunarhue/forms-react";

interface FieldProps<T> {
  readonly field: FieldApi<T>;
  readonly label: string;
}

// Base UI keeps its own label, ids and aria. The field gives each primitive
// its text or value, the writes, the blur, and `ref` so an invalid submit
// can focus it. Each component takes `ref` out of the field first: React
// Compiler treats an object whose member is passed as `ref` as a ref, and
// would flag every other read of `field` during render.
interface ErrorsProps {
  readonly errors: readonly FormError[];
}

function Errors({ errors }: ErrorsProps) {
  return (
    <Field.Error match render={<ul />}>
      {errors.map((error) => (
        <li key={error.message}>{error.message}</li>
      ))}
    </Field.Error>
  );
}

export function TextField({ field, label }: FieldProps<string>) {
  const { ref } = field;
  return (
    <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled}>
      <Field.Label>{label}</Field.Label>
      <Input
        ref={ref}
        value={field.text}
        // The event tells a mask where the caret was.
        onValueChange={(text, details) => field.setText(text, details.event)}
        onBlur={field.handleBlur}
        readOnly={field.readOnly}
      />
      <Errors errors={field.shownErrors} />
    </Field.Root>
  );
}

export function NumberField({ field, label }: FieldProps<number>) {
  const { ref } = field;
  const number = numberPieces(field);
  return (
    <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled}>
      <Field.Label>{label}</Field.Label>
      <Input
        inputMode="decimal"
        ref={ref}
        // Keeps "1." and "-" as typed while the field holds 1 and the value before.
        value={number.text}
        onValueChange={(text) => number.setText(text)}
        onBlur={number.handleBlur}
        readOnly={field.readOnly}
      />
      <Errors errors={field.shownErrors} />
    </Field.Root>
  );
}

export function CheckboxField({ field, label }: FieldProps<boolean>) {
  const { ref } = field;
  return (
    <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled}>
      <Field.Label>
        <Checkbox.Root
          ref={ref}
          checked={field.value}
          onCheckedChange={(checked) => field.setValue(checked)}
          onBlur={field.handleBlur}
          readOnly={field.readOnly}
        >
          <Checkbox.Indicator>✓</Checkbox.Indicator>
        </Checkbox.Root>
        {label}
      </Field.Label>
      <Errors errors={field.shownErrors} />
    </Field.Root>
  );
}
