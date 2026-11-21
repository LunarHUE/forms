import { tracking } from "@lunarhue/forms-core";
import { getOwner, onCleanup } from "solid-js";

// The package has no node types, so this declares the global the development check reads.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/** The elements registered for each field, by handle. */
const registry = new WeakMap<object, Set<HTMLElement>>();

/** The `<form>` element of each store, from `formProps.ref`. */
const formElements = new WeakMap<object, HTMLFormElement>();

/**
 * The handle of each registered element, for `fieldOf` in development. A
 * bundler folds the checks around it to false in production and drops the
 * map with them. Production reads core's `trackedField` instead.
 */
export const fields = /* @__PURE__ */ new WeakMap<Element, object>();

/** The elements registered for `handle` that are still in the document, in the order they registered. */
export function elementsOf(handle: object): HTMLElement[] {
  return [...(registry.get(handle) ?? [])].filter((element) => element.isConnected);
}

/**
 * True when the focused element is an element registered for `handle` or
 * sits inside one. An element that left the document can't contain it.
 */
export function hasFocus(handle: object): boolean {
  const active = typeof document === "undefined" ? null : document.activeElement;
  if (active === null) return false;
  for (const element of registry.get(handle) ?? []) if (element.contains(active)) return true;
  return false;
}

/**
 * Returns a ref callback that registers each element it gets as a focus
 * target of `handle`. Every element it registered is removed when the
 * current owner is disposed. Ref callbacks run with no owner, so the cleanup
 * is taken here. Each element registered or removed is reported to
 * `tracking`.
 */
export function elementRegistrar(handle: object): (element: HTMLElement) => void {
  const registered: HTMLElement[] = [];
  if (getOwner() !== null) {
    onCleanup(() => {
      for (const element of registered) {
        registry.get(handle)?.delete(element);
        tracking.record?.(element, handle, false, "solid");
        if (typeof process !== "undefined" && process.env.NODE_ENV !== "production" && fields.get(element) === handle) fields.delete(element);
      }
    });
  }
  return (element) => {
    let elements = registry.get(handle);
    if (!elements) registry.set(handle, (elements = new Set()));
    elements.add(element);
    registered.push(element);
    tracking.record?.(element, handle, true, "solid");
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") fields.set(element, handle);
  };
}

/** Records the `<form>` element of `store`. It is never reported as forgotten. */
export function registerFormElement(store: object, element: HTMLFormElement): void {
  formElements.set(store, element);
  tracking.record?.(element, store, true, "solid");
}

/** The `<form>` element of `store`, while it is in the document. */
export function formElementOf(store: object): HTMLFormElement | undefined {
  const element = formElements.get(store);
  return element?.isConnected ? element : undefined;
}
