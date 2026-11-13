import {
  createForm,
  createForms,
  type FieldApi,
} from "@lunarhue/forms-solid";
import { digits, mask } from "@lunarhue/forms-solid/plugins/mask";

// "5551234567" shows as "(555) 123-4567".
function formatPhone(value: string) {
  const area = value.slice(0, 3);
  const prefix = value.slice(3, 6);
  const line = value.slice(6, 10);
  if (value.length > 6) return `(${area}) ${prefix}-${line}`;
  if (value.length > 3) return `(${area}) ${prefix}`;
  return area;
}

interface PhoneFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

// The input shows the formatted number and sends what the user typed.
// The mask strips that back to digits before the store takes it.
function PhoneField(props: PhoneFieldProps) {
  return (
    <label>
      {props.label}
      <input
        {...props.field.inputProps()}
        type="tel"
        value={formatPhone(props.field.value)}
      />
    </label>
  );
}

const forms = createForms({ fields: { PhoneField } });

const contact = forms.define({
  defaultValues: { phone: "" },
  // The store only ever holds digits, so `onSubmit` gets digits.
  plugins: [mask({ phone: digits })],
  onSubmit: (value) => value.phone,
});

export default function ContactForm() {
  const form = createForm(contact);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.PhoneField name="phone" label="Phone" />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
