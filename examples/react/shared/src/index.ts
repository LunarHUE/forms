"use client";
// The "New order" example for React, shared by the Next.js, TanStack Start
// and Vite apps. The package exports only this module, so this one directive
// makes everything here client code under React Server Components: a server
// component can render `OrderPage` and pass it plain data and server
// actions. Bundlers without React Server Components ignore the directive.
// Vite's production build warns once that it drops it, which is harmless.
export { AddressFields, SameAsBilling } from "./address.js";
export type { AddressFieldsProps } from "./address.js";
export { RenderBadge, useRenderBadge } from "./badge.js";
export type { RenderBadgeProps } from "./badge.js";
export { CheckboxGroupField, FieldErrors, NumberField, RadioGroupField, SelectField, TextField } from "./fields.js";
export type {
  CheckboxGroupFieldProps,
  FieldErrorsProps,
  NumberFieldProps,
  RadioGroupFieldProps,
  SelectFieldProps,
  TextFieldProps,
} from "./fields.js";
export { Inspector } from "./inspector.js";
export type { InspectorProps } from "./inspector.js";
export { LineItems } from "./line-items.js";
export { AddressFieldset, forms, LineItemFieldset, order } from "./order.js";
export type { OrderDefaults, OrderFormInstance, OrderOptions } from "./order.js";
export { OrderForm } from "./order-form.js";
export { OrderPage } from "./order-page.js";
export type { OrderPageProps } from "./order-page.js";
export { DisabledErrors, FormErrors, FormStatus, OrderSummary, SaveOutcome, SubmitButton } from "./status.js";
export type { FormStatusProps } from "./status.js";
