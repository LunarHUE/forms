import { type NamedAnyFieldHandle, type AnyFormStore, tracking } from "@lunarhue/forms-core";
import { version } from "react";
import type { FocusOnInvalid } from "./forms.js";
import type { FieldRef } from "./input.js";
import { cached } from "./select.js";

// The package has no node types, so this declares the global the development check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

// Both keyed by field handle for field elements and by store for `<form>` elements.
const elements = new WeakMap<object, Set<HTMLElement>>();
const refs = new WeakMap<object, FieldRef>();

/**
 * The field handle of each field element, for `fieldOf` in development. A
 * bundler folds the checks around it to false in production and drops the
 * map with them. Production reads core's `trackedField` instead.
 */
export const fields = /* @__PURE__ */ new WeakMap<Element, object>();

/**
 * Drops the elements that left the document, so the set can't grow without
 * bound, and reports each to `trackElements`. Before React 19 this is the
 * only place an element of `key` is forgotten.
 */
function connected(set: Set<HTMLElement>, key: object): Set<HTMLElement> {
  for (const element of set) {
    if (!element.isConnected) {
      set.delete(element);
      tracking.record?.(element, key, false, "react");
    }
  }
  return set;
}

/** True when React calls the cleanup a ref callback returns. React 18.3 warns about one instead. */
const refCleanups = Number(version.split(".")[0]) >= 19;

/** Input types whose `value` property reads and writes the `value` attribute. */
const attributeValued = new Set(["checkbox", "radio", "file", "hidden", "submit", "image", "reset", "button"]);

/**
 * Puts back what React rendered in a form control the browser filled in
 * again. A browser can restore what the user typed before a reload once it
 * parses the server markup. Hydration leaves the control's value and checked
 * state alone, but sets `defaultValue`, `defaultChecked` and the selected
 * option's `defaultSelected` from the props, so a control whose live state
 * differs from those was restored. Outside hydration they match by the time
 * a ref runs, so this writes nothing.
 */
function showRendered(element: HTMLElement): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    // A textarea has no `checked` or `defaultChecked`, so the first check passes it by.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const control = element as HTMLInputElement;
    if (control.checked !== control.defaultChecked) control.checked = control.defaultChecked;
    // On these types `value` isn't what the user typed, and writing it sets the `value` attribute.
    if (!attributeValued.has(control.type) && control.value !== control.defaultValue) control.value = control.defaultValue;
  } else if (element instanceof HTMLSelectElement) {
    const rendered = [...element.options].find((option) => option.defaultSelected);
    if (rendered !== undefined && !rendered.selected) rendered.selected = true;
  }
}

/**
 * The ref callback that records its elements for `key`: a field handle for a
 * field's elements, or a store for its `<form>` elements. It is the same
 * function for the life of the key. On React 19 it returns a cleanup that
 * forgets the element. Earlier versions get no cleanup and call the callback
 * with `null` without saying which element left, so that call does nothing
 * and lookups skip elements that left the document. Each element recorded or
 * forgotten is reported to `tracking`, store keys included.
 */
export function refFor(key: object): FieldRef {
  return cached(refs, key, () => (element) => {
    if (element === null) return undefined;
    showRendered(element);
    const set = connected(cached(elements, key, () => new Set<HTMLElement>()), key);
    set.add(element);
    tracking.record?.(element, key, true, "react");
    // A store's elements are `<form>` elements, which aren't fields. Handles have a path.
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production" && "path" in key) fields.set(element, key);
    if (!refCleanups) return undefined;
    return () => {
      set.delete(element);
      tracking.record?.(element, key, false, "react");
      if (typeof process !== "undefined" && process.env.NODE_ENV !== "production" && fields.get(element) === key) fields.delete(element);
    };
  });
}

/** The connected elements recorded for `key`, in document order. */
export function elementsFor(key: object): HTMLElement[] {
  // A copy, sorted in place. `toSorted` is past the ES2020 the package targets.
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...connected(elements.get(key) ?? new Set(), key)].sort((a, b) =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING) === 0 ? -1 : 1,
  );
}

/** The first connected element, in document order, recorded for `key`. */
function firstElement(key: object): HTMLElement | undefined {
  let first: HTMLElement | undefined;
  for (const element of connected(elements.get(key) ?? new Set(), key)) {
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
  const field: NamedAnyFieldHandle<E> | undefined = store.firstInvalid();
  const element = (field === undefined ? undefined : firstElement(field)) ?? firstElement(store);
  if (focus === true) element?.focus();
  else focus({ field, disabled: store.disabledInvalid(), element });
}
