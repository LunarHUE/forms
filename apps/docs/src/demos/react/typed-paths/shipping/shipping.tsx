import { createForms, useForm } from "@lunarhue/forms-react";
import { TextField } from "./TextField";

const forms = createForms({ fields: { TextField } });

const order = forms.define({
  defaultValues: {
    shipping: { street: "", city: "" },
    billing: { street: "", city: "" },
  },
  onSubmit: (value) => value,
});

export default function ShippingForm() {
  const form = useForm(order);
  // Handles: typed, stable objects for one part of the value.
  const shipping = form.root.at("shipping");
  const billing = form.root.at("billing");
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          {/* Names are dotted paths, checked against the value's type. */}
          <form.TextField name="shipping.street" label="Shipping street" />
          <form.TextField name="shipping.city" label="Shipping city" />
          <button type="button" onClick={() => billing.setValue(shipping.peek().value)}>
            Bill to the same address
          </button>
          {/* A handle works where a name does. */}
          <form.TextField handle={billing.at("street")} label="Billing street" />
          <form.TextField handle={billing.at("city")} label="Billing city" />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
