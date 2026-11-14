import {
  createForm,
  createForms,
  type FieldApi,
} from "@lunarhue/forms-solid";
import { rules } from "@lunarhue/forms-solid/plugins/rules";
import { Show } from "solid-js";

interface Order {
  pickup: boolean;
  gift: boolean;
  street: string;
  message: string;
}

// Each rule gets the whole value and returns flags for its field.
// `disabled` is a field flag. `hidden` is the plugin's own meta, which
// the component reads. Name the value type: a key that isn't a field of
// `Order` is a type error, and so is installing the rules on a form
// whose value isn't an `Order`.
const orderRules = rules<Order>({
  street: (value) => ({ disabled: value.pickup }),
  message: (value) => ({ hidden: !value.gift }),
});

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField(props: TextFieldProps) {
  return (
    <Show when={!orderRules.meta(props.field).hidden}>
      <label>
        {props.label}
        {/* `inputProps()` sets `disabled` from the field. */}
        <input {...props.field.inputProps()} />
      </label>
    </Show>
  );
}

interface CheckboxProps {
  readonly field: FieldApi<boolean>;
  readonly label: string;
}

function Checkbox(props: CheckboxProps) {
  return (
    <label>
      <input {...props.field.inputProps({ kind: "checkbox" })} />
      {props.label}
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
  const form = createForm(order);
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
