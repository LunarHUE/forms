import type { AnyFieldHandle } from "./handle.js";
import { tracking } from "./store/elements.js";

/**
 * Called for each element an adapter's ref records or forgets. Core has no
 * DOM types, so `element` is an `object`; it is always an `Element`. `key` is a
 * field handle (it has a `path`) or, for a `<form>` element, the store.
 * React before 19 doesn't say which element left, so its removals arrive
 * late, the next time the adapter sweeps that key's elements.
 */
export type ElementListener = (element: object, key: object, added: boolean, adapter: string) => void;

/** The field handle of each tracked element. */
const fields = new WeakMap<object, AnyFieldHandle<unknown>>();

const listeners = new Set<ElementListener>();

/**
 * Starts recording which field each element belongs to, for `fieldOf` in
 * production, and passes every element event to `listener`. Call it before
 * the form renders: elements mounted before the first call aren't recorded.
 * Recording and listeners never stop once started.
 */
export function trackElements(listener?: ElementListener): void {
  if (!tracking.record) tracking.record = (element, key, added, adapter) => {
    if ("path" in key) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      if (added) fields.set(element, key as AnyFieldHandle<unknown>);
      else if (fields.get(element) === key) fields.delete(element);
    }
    for (const each of listeners) each(element, key, added, adapter);
  };
  if (listener) listeners.add(listener);
}

/**
 * The field handle recorded for `element` since `trackElements` ran, or
 * `undefined`. The adapters' `fieldOf` reads it in production.
 */
export const trackedField = (element: object): AnyFieldHandle<unknown> | undefined => fields.get(element);
