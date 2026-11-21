import { type NamedAnyFieldHandle, trackedField } from "@lunarhue/forms-core";
import type { HandleLike } from "./field.js";
import { elementsFor, fields } from "./refs.js";

// The package has no node types, so this declares the global the development check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * The elements of `handle` that are in the document, in document order.
 * Elements get here through the field's ref: `inputProps`, the field pieces
 * and `useFieldRef`.
 */
export function elementsOf(handle: HandleLike): HTMLElement[] {
  return elementsFor(handle);
}

/**
 * The field whose ref got `element`, or `undefined`. It is the same handle
 * `store.fieldAt(path)` returns, and it follows an array item when the item
 * moves. It doesn't look at ancestors: to find the field of an element
 * inside one, walk `parentElement` or `event.composedPath()` until it
 * returns a handle.
 *
 * In production it returns `undefined` unless the app called
 * `trackElements()` before the form rendered. Elements mounted before that
 * call aren't found. `devtools()` calls it for you.
 */
export function fieldOf(element: Element): NamedAnyFieldHandle<unknown> | undefined {
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
    // Only field refs fill the map, and they get core handles.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return fields.get(element) as NamedAnyFieldHandle<unknown> | undefined;
  }
  return trackedField(element);
}
