import type { ErrorMap, FormError } from "@lunarhue/forms-core";
import type { ReadonlyOrderDraft } from "./schema.js";

/** What `orderTotal` reads: the line items, complete or not. */
export type TotalInput = Pick<ReadonlyOrderDraft, "lineItems">;

/** A number the user may not have entered yet, as 0. */
const amount = (value: number | undefined) => (value !== undefined && Number.isFinite(value) ? value : 0);

/**
 * The order's total before the discount: quantity times unit price, summed
 * over the line items. A quantity or price that isn't filled in counts as 0.
 */
export function orderTotal(order: TotalInput): number {
  let total = 0;
  for (const item of order.lineItems) total += amount(item.quantity) * amount(item.unitPrice);
  return total;
}

/** What the customer pays: the total less the discount, never below 0. */
export function amountDue(order: TotalInput & Pick<ReadonlyOrderDraft, "discount">): number {
  return Math.max(0, orderTotal(order) - amount(order.discount));
}

/**
 * The rule the schema can't express: the discount can't exceed the order
 * total. Returns the error on `discount`, or undefined when the rule holds.
 */
export function discountErrors(order: TotalInput & Pick<ReadonlyOrderDraft, "discount">): ErrorMap<FormError> | undefined {
  const discount = amount(order.discount);
  const total = orderTotal(order);
  if (discount <= total) return undefined;
  return { fields: { discount: { message: `The discount can't exceed the order total of ${total.toFixed(2)}.` } } };
}
