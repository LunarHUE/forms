import { useForm } from "@lunarhue/forms-react";
import { AddressFields } from "./AddressFields";
import { forms, Order } from "./forms";

const order = forms.define({
  schema: Order,
  defaultValues: {
    name: "",
    shipping: { street: "", city: "" },
    billing: { street: "", city: "" },
  },
  onSubmit: (value) => value,
});

export default function OrderForm() {
  const form = useForm(order, { id: "order" });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.TextField name="name" label="Name" />
          <AddressFields field={form.root.at("shipping")} legend="Shipping" />
          <AddressFields field={form.root.at("billing")} legend="Billing" />
          <button type="submit">Save</button>
        </form>
      )}
    </form.Form>
  );
}
