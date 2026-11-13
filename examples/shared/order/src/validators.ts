import type {
  FieldValidators,
  FormValidator,
  SubmitContext,
  Validator,
  ValidatorOptions,
} from "@lunarhue/forms-core";
import * as v from "valibot";
import { discountErrors } from "./rules.js";
import type { Order, OrderDraft } from "./schema.js";
import { checkEmail, type SaveOrder, type SaveResult, serverSettings, submitOrder } from "./server.js";

/** How long the email check waits after the last keystroke, in milliseconds. */
export const emailDebounceMs = 400;

/** The form validator for the discount rule. Its error lands on `discount`. */
export const discountRule: FormValidator<OrderDraft> = (order) => discountErrors(order);

const EmailFormat = v.pipe(v.string(), v.email());

/**
 * Asks the fake server whether the email is free. It skips addresses the
 * schema already rejects, passes the validator's signal on so a newer run
 * aborts the older one, and uses the shared server settings' delay.
 */
export const emailAvailable: Validator<string> = async (email, ctx) => {
  if (!v.is(EmailFormat, email)) return undefined;
  const { available } = await checkEmail(email, { signal: ctx.signal, delayMs: serverSettings.get().delayMs });
  return available ? undefined : { message: "That email address already has an account." };
};

/** `emailAvailable` with its debounce, as a field validator entry. */
export const emailField: ValidatorOptions<string> = { validate: emailAvailable, debounce: emailDebounceMs };

/** The `validate` part of the definition: the discount rule and the debounced email check. */
export interface OrderValidate {
  readonly form: FormValidator<OrderDraft>;
  readonly fields: FieldValidators<OrderDraft>;
}

/**
 * The validators the schema doesn't cover, shaped for the definition's
 * `validate` option. Every adapter's definition passes this same object:
 *
 * ```ts
 * forms.define({ schema: OrderSchema, defaultValues: loadOrder(), validate: orderValidate, onSubmit: orderOnSubmit })
 * ```
 *
 * They return `FormError`, so they fit a `createForms` without `mapError`.
 */
export const orderValidate: OrderValidate = {
  form: discountRule,
  fields: { customer: { email: emailField } },
};

/** The `onSubmit` of the order definition. */
export type OrderOnSubmit = (order: Order, ctx: SubmitContext<OrderDraft>) => Promise<SaveResult>;

/**
 * Makes the definition's `onSubmit`: it saves through `submitOrder` with the
 * shared server settings and the submit's signal, sending the order to
 * `save` when one is given and to `saveOrder` otherwise. When the server
 * refuses, it puts the server's errors on the form with `store.setErrors`,
 * unless the form was reset while the save ran. Either way it resolves the
 * server's answer, which becomes the submission's result.
 */
export function orderOnSubmitWith(save?: SaveOrder): OrderOnSubmit {
  return async (order, ctx) => {
    const result = await submitOrder(order, { signal: ctx.signal, ...(save ? { save } : {}) });
    if (!result.ok && !ctx.signal.aborted) ctx.store.setErrors(result.errors);
    return result;
  };
}

/** The definition's `onSubmit` when the order is saved in this process: `orderOnSubmitWith()`. */
export const orderOnSubmit: OrderOnSubmit = orderOnSubmitWith();
