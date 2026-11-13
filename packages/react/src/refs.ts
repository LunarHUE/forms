import type { AnyFieldHandle, AnyFormStore } from "@lunarhue/forms-core";
import type { FocusOnInvalid } from "./forms.js";
import type { FieldRef } from "./input.js";
import { cached } from "./select.js";

type FormRef = (element: HTMLFormElement | null) => (() => void) | undefined;

// Keyed by field handle for field elements and by store for `<form>` elements.
const elements = new WeakMap<object, Set<HTMLElement>>();
const fieldRefs = new WeakMap<object, FieldRef>();
const formRefs = new WeakMap<object, FormRef>();

/** Drops the elements that left the document, so the set can't grow without bound. */
function connected(set: Set<HTMLElement>): Set<HTMLElement> {
  for (const element of set) if (!element.isConnected) set.delete(element);
  return set;
}

/**
 * Makes a ref callback that records its elements for `key`. React 19 calls
 * the cleanup it returns. React 18 ignores the cleanup and calls the
 * callback with `null` without saying which element left, so that call does
 * nothing and lookups skip elements that left the document.
 */
function recorder(key: object): FieldRef {
  return (element) => {
    if (element === null) return undefined;
    const set = connected(cached(elements, key, () => new Set<HTMLElement>()));
    set.add(element);
    return () => {
      set.delete(element);
    };
  };
}

/** The ref callback for a field's elements, the same function for the life of the handle. */
export function fieldRef(handle: object): FieldRef {
  return cached(fieldRefs, handle, () => recorder(handle));
}

/** The ref callback that records a store's `<form>` elements, the same function for the life of the store. */
export function formRef(store: object): FormRef {
  return cached(formRefs, store, () => recorder(store));
}

/** The first connected element, in document order, recorded for `key`. */
function firstElement(key: object): HTMLElement | undefined {
  let first: HTMLElement | undefined;
  for (const element of connected(elements.get(key) ?? new Set())) {
    if (first === undefined || (first.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING) !== 0) first = element;
  }
  return first;
}

/** Applies `focusOnInvalid` after a submit that ended invalid. */
export function focusInvalid<E>(store: AnyFormStore<E>, focus: FocusOnInvalid<E>): void {
  if (focus === false) return;
  const field: AnyFieldHandle<E> | undefined = store.firstInvalid();
  const element = (field === undefined ? undefined : firstElement(field)) ?? firstElement(store);
  if (focus === true) element?.focus();
  else focus({ field, disabled: store.disabledInvalid(), element });
}
