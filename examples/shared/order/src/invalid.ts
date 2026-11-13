import type { OrderDraft } from "./schema.js";
import { takenEmail } from "./server.js";

/**
 * A value that breaks several rules at once, for the inspector's "fill with
 * invalid data" control: an empty name, a taken email, no delivery method, a
 * line item with no description and a fractional quantity, another with a
 * missing quantity and a negative price, a discount above the total, and a
 * shipping address with no city or country.
 */
export const invalidOrder: OrderDraft = {
  customer: { name: "", email: takenEmail },
  delivery: undefined,
  notifications: ["sms"],
  lineItems: [
    { description: "", quantity: 1.5, unitPrice: 10 },
    { description: "Mystery box", quantity: undefined, unitPrice: -4 },
  ],
  discount: 500,
  billing: { street: "1 High Street", city: "Bristol", postcode: "BS1 1AA", country: "GB" },
  shipping: { street: "9 Rue de Rivoli", city: "", postcode: "75001", country: undefined },
  sameAsBilling: false,
};
