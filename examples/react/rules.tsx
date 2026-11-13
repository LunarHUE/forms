import {
  createForms,
  type FieldApi,
  useForm,
} from "@lunarhue/forms-react";
import { rules } from "@lunarhue/forms-react/plugins/rules";

interface Order {
  pickup: boolean;
  gift: boolean;
  street: string;
  message: string;
}

// Each rule gets the whole value and returns flags for its field.
// `disabled` is a field flag. `hidden` is the plugin's own meta, which
// the component reads. `rules` doesn't know the form, so name the
// value type.
const orderRules = rules<Order>({
  street: (value) => ({ disabled: value.pickup }),
  message: (value) => ({ hidden: !value.gift }),
});

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField({ field, label }: TextFieldProps) {
  if (orderRules.meta(field)?.hidden === true) return null;
  return (
    <label>
      {label}
      {/* `inputProps()` sets `disabled` from the field. */}
      <input {...field.inputProps()} />
    </label>
  );
}

interface CheckboxProps {
  readonly field: FieldApi<boolean>;
  readonly label: string;
}

function Checkbox({ field, label }: CheckboxProps) {
  return (
    <label>
      <input {...field.inputProps({ kind: "checkbox" })} />
      {label}
    </label>
  );
}

const forms = createForms({ fields: { TextField, Checkbox } });

const order = forms.define({
  defaultValues: {
    pickup: false,
    gift: false,
    street: "",
    message: "",
  },
  plugins: [orderRules],
  onSubmit: (value) => value,
});

export default function DeliveryForm() {
  const form = useForm(order);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Checkbox name="pickup" label="I'll pick it up" />
          <form.TextField name="street" label="Street" />
          <form.Checkbox name="gift" label="It's a gift" />
          <form.TextField name="message" label="Gift message" />
          <button type="submit">Order</button>
        </form>
      )}
    </form.Form>
  );
}
