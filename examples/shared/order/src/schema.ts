import type { DeepReadonly, Draft } from "@lunarhue/forms-core";
import * as v from "valibot";

/** One choice in a radio group, checkbox group or select. */
export interface Option<T extends string> {
  /** The value the form stores. */
  readonly value: T;
  /** The text to show. */
  readonly label: string;
}

/** The delivery methods, in the order the radio group shows them. */
export const deliveryMethods = [
  { value: "standard", label: "Standard (3 to 5 days)" },
  { value: "express", label: "Express (1 to 2 days)" },
  { value: "overnight", label: "Overnight" },
] as const satisfies readonly Option<string>[];

/** The notification channels, in the order the checkbox group shows them. */
export const notificationChannels = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "push", label: "Push" },
] as const satisfies readonly Option<string>[];

/** The countries an address can be in, in the order the select shows them. */
export const countries = [
  { value: "GB", label: "United Kingdom" },
  { value: "IE", label: "Ireland" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
  { value: "NL", label: "Netherlands" },
  { value: "US", label: "United States" },
] as const satisfies readonly Option<string>[];

/** A delivery method's value. */
export type DeliveryMethod = (typeof deliveryMethods)[number]["value"];
/** A notification channel's value. */
export type NotificationChannel = (typeof notificationChannels)[number]["value"];
/** A country code. */
export type Country = (typeof countries)[number]["value"];

const values = <T extends string>(options: readonly Option<T>[]) => options.map((option) => option.value);

const required = (message: string) => v.pipe(v.string(), v.nonEmpty(message));

/** A postal address. */
export const AddressSchema = v.object({
  street: required("Enter a street."),
  city: required("Enter a city."),
  postcode: required("Enter a postcode."),
  country: v.picklist(values(countries), "Choose a country."),
});

/** One line of an order. */
export const LineItemSchema = v.object({
  description: required("Describe the item."),
  quantity: v.pipe(
    v.number("Enter a quantity."),
    v.integer("Use a whole number."),
    v.minValue(1, "Order at least one."),
  ),
  unitPrice: v.pipe(v.number("Enter a price."), v.minValue(0, "The price can't be negative.")),
});

/** The "New order" form. */
export const OrderSchema = v.object({
  customer: v.object({
    name: required("Enter the customer's name."),
    email: v.pipe(v.string(), v.nonEmpty("Enter an email address."), v.email("Enter a valid email address.")),
  }),
  delivery: v.picklist(values(deliveryMethods), "Choose a delivery method."),
  notifications: v.array(v.picklist(values(notificationChannels))),
  lineItems: v.pipe(v.array(LineItemSchema), v.minLength(1, "Add at least one item.")),
  discount: v.pipe(v.number("Enter a discount, or 0."), v.minValue(0, "The discount can't be negative.")),
  billing: AddressSchema,
  shipping: AddressSchema,
  sameAsBilling: v.boolean(),
});

/** A complete, valid address. */
export type Address = v.InferOutput<typeof AddressSchema>;
/** A complete, valid line item. */
export type LineItem = v.InferOutput<typeof LineItemSchema>;
/** A complete, valid order: what `onSubmit` and the server get. */
export type Order = v.InferOutput<typeof OrderSchema>;

/**
 * The value the form holds while the user fills it in. A form defined with
 * `OrderSchema` and the `valibot()` plugin has this value type: numbers, the
 * delivery method and countries may be undefined.
 */
export type OrderDraft = Draft<v.InferInput<typeof OrderSchema>>;

/** An order as validators and snapshots see it. */
export type ReadonlyOrderDraft = DeepReadonly<OrderDraft>;
