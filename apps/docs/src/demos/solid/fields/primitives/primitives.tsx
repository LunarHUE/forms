import { createForm, createForms, fieldValidators } from "@lunarhue/forms-solid";
import { CheckboxField, NumberField, TextField } from "./fields";
import { docsDevtools } from "@/devtools/enabled";

const forms = createForms({ plugins: [docsDevtools] });

const order = forms.define({
  defaultValues: { name: "", quantity: undefined as number | undefined, terms: false },
  validate: {
    fields: fieldValidators({
      name: (name) => (name === "" ? { message: "Enter your name." } : undefined),
      quantity: (quantity) =>
        quantity === undefined || quantity < 0.5 ? { message: "Order at least half a box." } : undefined,
      terms: (accepted) => (accepted ? undefined : { message: "Accept the terms." }),
    }),
  },
  onSubmit: (value) => value,
});

export default function OrderForm() {
  const form = createForm(order, { id: "primitives" });
  return (
    <form.Form>
      {(formProps) => (
        <form {...formProps}>
          <form.Field name="name">{(field) => <TextField field={field} label="Name" />}</form.Field>
          <form.Field name="quantity">{(field) => <NumberField field={field} label="Boxes" />}</form.Field>
          <form.Field name="terms">{(field) => <CheckboxField field={field} label="I accept the terms" />}</form.Field>
          <div>
            <button type="submit">Order</button>
            <button type="button" onClick={() => form.root.reset()}>
              Clear
            </button>
          </div>
        </form>
      )}
    </form.Form>
  );
}
