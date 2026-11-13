import type { RuntimeStore } from "./form-runtime.js";
import type { FocusOnInvalid, FocusTarget } from "./forms.js";
import { elementsOf, formElementOf } from "./refs.js";

/** What happens after an invalid submit, with the error type erased. */
export type RuntimeFocus = FocusOnInvalid<unknown>;

/** Builds the focus target from the store after a submit ends invalid. */
function focusTarget(store: RuntimeStore): FocusTarget<unknown> {
  const field = store.firstInvalid();
  const fieldElement = field === undefined ? undefined : elementsOf(store, field.id)[0];
  return {
    field,
    disabled: store.disabledInvalid(),
    element: fieldElement ?? formElementOf(store),
  };
}

/** Applies `focusOnInvalid` after a submit that ended invalid. */
export function focusInvalid(store: RuntimeStore, focusOnInvalid: RuntimeFocus): void {
  if (focusOnInvalid === false) return;
  const target = focusTarget(store);
  if (typeof focusOnInvalid === "function") {
    focusOnInvalid(target);
    return;
  }
  const { element } = target;
  if (element === undefined) return;
  // jsdom and some embedded browsers have no `scrollIntoView`.
  if ("scrollIntoView" in element) element.scrollIntoView({ block: "nearest" });
  element.focus();
}
