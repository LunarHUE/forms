import type { AnyFieldHandle, AnyFormStore } from "@lunarhue/forms-core";
import type { FocusOnInvalid } from "./forms.js";
import type { FieldRef } from "./input.js";
import { cached } from "./select.js";

type FormRef = (element: HTMLFormElement | null) => (() => void) | undefined;

const elements = new WeakMap<object, Set<HTMLElement>>();
const formElements = new WeakMap<object, HTMLFormElement>();
const fieldRefs = new WeakMap<object, Map<string, FieldRef>>();
const formRefs = new WeakMap<object, FormRef>();

/**
 * Makes a ref callback that records its element with `add`. React 19 calls
 * the cleanup `add` returns. React 18 ignores it and calls the callback
 * again with `null`, which runs the cleanup of the element it last recorded.
 */
function recorder<T extends HTMLElement>(add: (element: T) => () => void): (element: T | null) => (() => void) | undefined {
  let remove: (() => void) | undefined;
  return (element) => {
    if (element === null) {
      remove?.();
      remove = undefined;
      return undefined;
    }
    remove = add(element);
    return remove;
  };
}

/**
 * The ref callback for one field's element, the same function for the life
 * of the handle. `option` tells apart the radios and boxes of one field.
 */
export function fieldRef(handle: object, option: string): FieldRef {
  return cached(cached(fieldRefs, handle, () => new Map<string, FieldRef>()), option, () =>
    recorder<HTMLElement>((element) => {
      const set = cached(elements, handle, () => new Set<HTMLElement>());
      set.add(element);
      return () => {
        set.delete(element);
      };
    }),
  );
}

/** The ref callback that records a store's `<form>` element, the same function for the life of the store. */
export function formRef(store: object): FormRef {
  return cached(formRefs, store, () =>
    recorder<HTMLFormElement>((element) => {
      formElements.set(store, element);
      return () => {
        if (formElements.get(store) === element) formElements.delete(store);
      };
    }),
  );
}

/** The first connected element, in document order, recorded for a field. */
function firstElement(handle: object): HTMLElement | undefined {
  let first: HTMLElement | undefined;
  for (const element of elements.get(handle) ?? []) {
    if (!element.isConnected) continue;
    if (first === undefined || (first.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING) !== 0) first = element;
  }
  return first;
}

/** Applies `focusOnInvalid` after a submit that ended invalid. */
export function focusInvalid<E>(store: AnyFormStore<E>, focus: FocusOnInvalid<E>): void {
  if (focus === false) return;
  const field: AnyFieldHandle<E> | undefined = store.firstInvalid();
  const element = (field === undefined ? undefined : firstElement(field)) ?? formElements.get(store);
  if (focus === true) element?.focus();
  else focus({ field, disabled: store.disabledInvalid(), element });
}
