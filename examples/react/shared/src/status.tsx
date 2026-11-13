import { amountDue } from "@lunarhue/forms-example-order";
import { useDisabledErrors, useField, useFormContext, useFormState } from "@lunarhue/forms-react";
import { useDeferredValue } from "react";
import { RenderBadge, useRenderBadge } from "./badge.js";
import { money } from "./line-items.js";
import { order } from "./order.js";

/**
 * The submit button. It takes the form from context with the untyped
 * `useFormContext`, which works under any `form.Form`, so the same button
 * fits every form. It reads one boolean from the form snapshot, so it
 * re-renders only when a submit starts or ends.
 */
export function SubmitButton() {
  const form = useFormContext();
  const submitting = useFormState(form, (snapshot) => snapshot.submitting);
  const badge = useRenderBadge();
  return (
    <>
      <button type="submit" className="button button-primary" disabled={submitting}>
        {submitting ? "Saving..." : "Place order"}
      </button>
      <RenderBadge counter={badge} name="SubmitButton" />
    </>
  );
}

/**
 * One line saying where the last submit stands. It uses the definition's
 * own `order.useFormContext()`, which types the submission's result as the
 * fake server's `SaveResult`.
 */
export function FormStatus() {
  const form = order.useFormContext();
  const submission = useFormState(form, (snapshot) => snapshot.submission);
  let text = "";
  if (submission.status === "submitting") text = "Saving the order.";
  else if (submission.status === "invalid") text = "Fix the errors above, then try again.";
  else if (submission.status === "failed") text = "The save failed. Try again.";
  else if (submission.status === "succeeded") {
    const { result } = submission;
    text = result.ok ? `Saved as ${result.id}.` : "The server refused the order.";
  }
  return (
    <span className="form-status" role="status" data-status={submission.status}>
      {text}
    </span>
  );
}

/**
 * Errors on the form as a whole, such as the one the server sends when it
 * refuses a save. Core puts them on the root field.
 */
export function FormErrors() {
  const form = order.useFormContext();
  const errors = useField(form.root, (snapshot) => snapshot.shownErrors);
  return (
    <ul className="form-errors" aria-label="Form errors">
      {errors.map((error) => (
        <li key={error.message}>{error.message}</li>
      ))}
    </ul>
  );
}

/**
 * The disabled fields whose errors blocked the last submit. A disabled
 * input can't take focus or be fixed in place, so after such a submit the
 * adapter focuses the form element and `useDisabledErrors` lists them here.
 * Untick "same as billing" to fix them.
 */
export function DisabledErrors() {
  const form = order.useFormContext();
  const disabled = useDisabledErrors(form);
  return (
    <ul className="form-errors" aria-label="Errors in disabled fields">
      {disabled.map((entry) => (
        <li key={entry.name}>
          {entry.name}: {entry.errors.map((error) => error.message).join(" ")}
        </li>
      ))}
    </ul>
  );
}

/**
 * The amount due. It reads the whole value through a selector that returns
 * one number, so typing in the customer's name doesn't re-render it, while a
 * new quantity, price or discount does.
 *
 * The number then goes through `useDeferredValue`. That is here to show a
 * deferred read works with the adapter: the value comes from
 * `useSyncExternalStore`, so React can render the summary behind the input
 * and it still ends on the value the store holds.
 */
export function OrderSummary() {
  const form = order.useFormContext();
  const due = useField(form.root, (snapshot) => amountDue(snapshot.value));
  const deferred = useDeferredValue(due);
  const badge = useRenderBadge();
  return (
    <p className="field">
      <span className="field-label">
        Amount due <RenderBadge counter={badge} name="OrderSummary" />
      </span>
      <output data-testid="amount-due">{money(deferred)}</output>
    </p>
  );
}
