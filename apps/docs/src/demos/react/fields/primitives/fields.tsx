import { Checkbox } from "@base-ui/react/checkbox";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import type { FieldApi, FormError } from "@lunarhue/forms-react";

interface FieldProps<T> {
  readonly field: FieldApi<T>;
  readonly label: string;
}

// Base UI keeps its own label, ids and aria. The field gives each primitive
// its text or value, the writes, the blur, and `ref` so an invalid submit
// can focus it.
function Errors({ errors }: { readonly errors: readonly FormError[] }) {
  return (
    <Field.Error match render={<ul />}>
      {errors.map((error) => (
        <li key={error.message}>{error.message}</li>
      ))}
    </Field.Error>
  );
}

export function TextField({ field, label }: FieldProps<string>) {
  return (
    <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled}>
      <Field.Label>{label}</Field.Label>
      <Input
        ref={field.ref}
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
  return (
    <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled}>
      <Field.Label>{label}</Field.Label>
      <Input
        inputMode="decimal"
        ref={field.ref}
        // Keeps "1." and "-" as typed while the field holds 1 and the value before.
        value={field.text}
        onValueChange={(text) => field.setNumberText(text)}
        onBlur={field.handleBlur}
        readOnly={field.readOnly}
      />
      <Errors errors={field.shownErrors} />
    </Field.Root>
  );
}

export function CheckboxField({ field, label }: FieldProps<boolean>) {
  return (
    <Field.Root name={field.name} invalid={field.shownErrors.length > 0} disabled={field.disabled}>
      <Field.Label>
        <Checkbox.Root
          ref={field.ref}
          checked={field.value === true}
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
