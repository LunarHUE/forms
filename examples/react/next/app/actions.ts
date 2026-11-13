"use server";
import { saveOrder, type Order, type SaveRequest, type SaveResult } from "@lunarhue/forms-example-order";

/**
 * Saves an order on the server. The client calls it through the form's
 * `onSubmit` with the inspector's settings as plain data, since the fake
 * server's settings live in the browser. A server action's arguments come
 * from the network whatever their types say, so `saveOrder` checks the
 * order with `OrderSchema` again before it accepts it.
 */
export async function saveOrderAction(order: Order, request: SaveRequest): Promise<SaveResult> {
  return saveOrder(order, { delayMs: request.delayMs, reject: request.reject });
}
