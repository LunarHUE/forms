import { deliveryMethods, notificationChannels } from "@lunarhue/forms-example-order";
import { AddressFields, SameAsBilling } from "./address.js";
import { RenderBadge, useRenderBadge } from "./badge.js";
import { CheckboxGroupField, RadioGroupField } from "./fields.js";
import { LineItems } from "./line-items.js";
import { order } from "./order.js";
import { DisabledErrors, FormErrors, FormStatus, OrderSummary, SubmitButton } from "./status.js";

/**
 * The customer's name and email, as registered components bound to the
 * form. The email has the order package's debounced server check, so
 * `TextField` shows "Checking..." while the field is `validating`.
 */
function CustomerFields() {
  const form = order.useFormContext();
  const badge = useRenderBadge();
  return (
    <fieldset className="fieldset">
      <legend>
        Customer <RenderBadge counter={badge} name="Customer fieldset" />
      </legend>
      {/* Registered components: `TextField` with `field` filled in from `name`. */}
      <form.TextField name="customer.name" label="Name" autoComplete="name" />
      <form.TextField name="customer.email" label="Email" type="email" autoComplete="email" />
    </fieldset>
  );
}

/** Delivery method and notification channels. */
function DeliveryFields() {
  const form = order.useFormContext();
  const badge = useRenderBadge();
  return (
    <fieldset className="fieldset">
      <legend>
        Delivery <RenderBadge counter={badge} name="Delivery fieldset" />
      </legend>
      {/*
        The `Field` render form: `form.Field` reads the field and passes its
        field object to the function. The option components are generic, so
        they are rendered here instead of being registered.
      */}
      <form.Field name="delivery">
        {(field) => (
          <RadioGroupField
            field={field}
            label="Delivery method"
            options={deliveryMethods}
            radio={(value) => field.inputProps({ kind: "radio", value })}
          />
        )}
      </form.Field>
      <form.Field name="notifications">
        {(field) => (
          <CheckboxGroupField
            field={field}
            label="Notify the customer by"
            options={notificationChannels}
            checkbox={(value) => field.inputProps({ kind: "checkbox", value })}
          />
        )}
      </form.Field>
    </fieldset>
  );
}

/** The discount and the amount due. The form-level discount rule puts its error on `discount`. */
function PaymentFields() {
  const form = order.useFormContext();
  const badge = useRenderBadge();
  return (
    <fieldset className="fieldset">
      <legend>
        Payment <RenderBadge counter={badge} name="Payment fieldset" />
      </legend>
      <form.NumberField name="discount" label="Discount" step={0.01} />
      <OrderSummary />
    </fieldset>
  );
}

/**
 * The whole "New order" form. It needs `order.Form` (here, `form.Form` in
 * `OrderPage`) above it, and takes the form from context. The `<form>`
 * element gets `formProps`: the id, `noValidate`, the submit handler and the
 * ref that makes it the focus fallback after an invalid submit.
 */
export function OrderForm() {
  const form = order.useFormContext();
  return (
    <form {...form.formProps} className="order-form" aria-label="New order">
      <CustomerFields />
      <DeliveryFields />
      <LineItems />
      <PaymentFields />
      <AddressFields field={form.root.at("billing")} legend="Billing address" />
      <SameAsBilling />
      <AddressFields field={form.root.at("shipping")} legend="Shipping address" />
      <div className="form-actions">
        <SubmitButton />
        <FormStatus />
      </div>
      {/* Below the button, so they can appear without moving it. */}
      <FormErrors />
      <DisabledErrors />
    </form>
  );
}
