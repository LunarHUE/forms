import {
  AddressSchema,
  LineItemSchema,
  orderOnSubmitWith,
  OrderSchema,
  orderValidate,
  type SaveOrder,
} from "@lunarhue/forms-example-order";
import { createForms, type DeepPartial, type FormOf } from "@lunarhue/forms-react";
import { dirty } from "@lunarhue/forms-react/plugins/dirty";
import { rules } from "@lunarhue/forms-react/plugins/rules";
import { valibot } from "@lunarhue/forms-schema/valibot";
import type * as v from "valibot";
import { CheckboxGroupField, NumberField, RadioGroupField, SelectField, TextField } from "./fields.js";

/**
 * The app's one `createForms` call, at module scope. The valibot adapter
 * gives every schema form its starting values, so `defaultValues` is
 * optional. `dirty()` gives each field and the form the `dirty` flag the
 * inspector shows. The field components are registered, so every form and
 * scope made here has them bound: `form.TextField name="customer.name"`. The
 * option components are written with `Choice`, so each use checks its
 * options against the named field.
 */
export const forms = createForms({
  plugins: [valibot(), dirty()],
  fields: { TextField, NumberField, SelectField, RadioGroupField, CheckboxGroupField },
});

/** A shape for `AddressFields`. The schema only types it: the order schema validates. */
export const AddressFieldset = forms.fieldset(AddressSchema);

/** A shape for one line item row. */
export const LineItemFieldset = forms.fieldset(LineItemSchema);

/** The order form's value. */
export type OrderValue = v.InferInput<typeof OrderSchema>;

/** Starting values for the order form: any part of an order, at any depth. */
export type OrderDefaults = DeepPartial<OrderValue>;

/** What each mounted order form is made with. */
export interface OrderOptions {
  /**
   * Where the order is saved. The SPA passes `saveOrder` from the fake
   * server, and Next.js passes a server action that calls it on the server.
   */
  readonly save: SaveOrder;
  /** The order to start from, such as one a server loaded. Without it the form starts empty. */
  readonly defaultValues?: OrderDefaults;
}

/**
 * The "New order" form. It uses the function form of `define`: the function
 * runs once per mounted form with the options given to `useForm`, so each
 * form gets its own starting values and its own save function. `useForm`
 * reads the options on the first render only.
 */
export const order = forms.define((options: OrderOptions) => ({
  schema: OrderSchema,
  ...(options.defaultValues === undefined ? {} : { defaultValues: options.defaultValues }),
  // "Same as billing" disables the whole shipping address, whatever wrote
  // the value: the checkbox, the inspector's reset or "fill with invalid
  // data". The rule runs when the form is made too, so the server renders
  // the shipping inputs disabled already and they don't flip after hydration.
  plugins: [rules<OrderValue>({ shipping: (value) => ({ disabled: value.sameAsBilling }) })],
  validate: orderValidate,
  onSubmit: orderOnSubmitWith(options.save),
}));

/** A mounted order form, as `useForm(order, options)` returns it. */
export type OrderFormInstance = FormOf<typeof order>;
