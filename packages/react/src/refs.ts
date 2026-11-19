import type { AnyFieldHandle, AnyFormStore } from "@lunarhue/forms-core";
import { version } from "react";
import type { FocusOnInvalid } from "./forms.js";
import type { FieldRef } from "./input.js";
import { cached } from "./select.js";

// Both keyed by field handle for field elements and by store for `<form>` elements.
const elements = new WeakMap<object, Set<HTMLElement>>();
const refs = new WeakMap<object, FieldRef>();

/** Drops the elements that left the document, so the set can't grow without bound. */
function connected(set: Set<HTMLElement>): Set<HTMLElement> {
  for (const element of set) if (!element.isConnected) set.delete(element);
  return set;
}

/** True when React calls the cleanup a ref callback returns. React 18.3 warns about one instead. */
const refCleanups = Number(version.split(".")[0]) >= 19;

/**
 * The ref callback that records its elements for `key`: a field handle for a
 * field's elements, or a store for its `<form>` elements. It is the same
 * function for the life of the key. On React 19 it returns a cleanup that
 * forgets the element. Earlier versions get no cleanup and call the callback
 * with `null` without saying which element left, so that call does nothing
 * and lookups skip elements that left the document.
 */
export function refFor(key: object): FieldRef {
  return cached(refs, key, () => (element) => {
    if (element === null) return undefined;
    const set = connected(cached(elements, key, () => new Set<HTMLElement>()));
    set.add(element);
    if (!refCleanups) return undefined;
    return () => {
      set.delete(element);
    };
  });
}

/** The first connected element, in document order, recorded for `key`. */
function firstElement(key: object): HTMLElement | undefined {
  let first: HTMLElement | undefined;
  for (const element of connected(elements.get(key) ?? new Set())) {
    if (first === undefined || (first.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING) !== 0) first = element;
  }
  return first;
}

/**
 * The focused element when it is an element recorded for `key` or sits
 * inside one. A primitive that hands back only a value still leaves the
 * caret there, so a display edit can place it.
 */
export function focusedElement(key: object): Element | undefined {
  const active = typeof document === "undefined" ? null : document.activeElement;
  if (active === null) return undefined;
  for (const element of elements.get(key) ?? []) if (element.contains(active)) return active;
  return undefined;
}

/** Applies `focusOnInvalid` after a submit that ended invalid. */
export function focusInvalid<E>(store: AnyFormStore<E>, focus: FocusOnInvalid<E>): void {
  if (focus === false) return;
  const field: AnyFieldHandle<E> | undefined = store.firstInvalid();
  const element = (field === undefined ? undefined : firstElement(field)) ?? firstElement(store);
  if (focus === true) element?.focus();
  else focus({ field, disabled: store.disabledInvalid(), element });
}
