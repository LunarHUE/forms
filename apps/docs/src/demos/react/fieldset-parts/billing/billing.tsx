import { useForm } from "@lunarhue/forms-react";
import { BillingFields } from "./BillingFields";
import { BillingFieldset, forms } from "./forms";

const order = forms.define(
  {
    defaultValues: {
      shipping: { street: "", city: "" },
      billing: { sameAsShipping: true, address: { street: "", city: "" } },
    },
    onSubmit: (value) => value,
  },
  // Pinned: the rule attaches when the store is made, not when the
  // fieldset's scope is first read.
  BillingFieldset.at("billing"),
);

export default function BillingForm() {
  const form = useForm(order);
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="shipping.street" label="Shipping street" />
          <form.TextField name="shipping.city" label="Shipping city" />
          <BillingFields field={form.root.at("billing")} />
          <button type="submit">Order</button>
        </form>
      )}
    </form.Form>
  );
}
