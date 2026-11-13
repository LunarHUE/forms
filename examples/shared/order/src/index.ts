// The "New order" example, without any framework: the schema, validators,
// fake server and helpers every example app shares. The page's CSS is
// `@lunarhue/forms-example-order/styles.css`.
export {
  AddressSchema,
  countries,
  deliveryMethods,
  LineItemSchema,
  notificationChannels,
  OrderSchema,
} from "./schema.js";
export type {
  Address,
  Country,
  DeliveryMethod,
  LineItem,
  NotificationChannel,
  Option,
  Order,
  OrderDraft,
  ReadonlyOrderDraft,
} from "./schema.js";
export { amountDue, discountErrors, orderTotal } from "./rules.js";
export type { TotalInput } from "./rules.js";
export {
  discountRule,
  emailAvailable,
  emailDebounceMs,
  emailField,
  orderOnSubmit,
  orderValidate,
} from "./validators.js";
export type { OrderValidate } from "./validators.js";
export {
  checkEmail,
  createServerSettings,
  loadOrder,
  normalDelayMs,
  saveOrder,
  serverSettings,
  slowDelayMs,
  submitOrder,
  takenEmail,
} from "./server.js";
export type { CallOptions, EmailCheck, SaveOptions, SaveResult, ServerSettings, ServerSettingsState } from "./server.js";
export { invalidOrder } from "./invalid.js";
export { bumpBadge, restartFlash } from "./badge.js";
