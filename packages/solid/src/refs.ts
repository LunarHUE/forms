import { getOwner, onCleanup } from "solid-js";

/** The elements registered for each field, by handle. */
const registry = new WeakMap<object, Set<HTMLElement>>();

/** The `<form>` element of each store, from `formProps.ref`. */
const formElements = new WeakMap<object, HTMLFormElement>();

/** The elements registered for `handle` that are still in the document. */
export function elementsOf(handle: object): HTMLElement[] {
  return [...(registry.get(handle) ?? [])].filter((element) => element.isConnected);
}

/**
 * Returns a ref callback that registers each element it gets as a focus
 * target of `handle`. Every element it registered is removed when the
 * current owner is disposed. Ref callbacks run with no owner, so the cleanup
 * is taken here.
 */
export function elementRegistrar(handle: object): (element: HTMLElement) => void {
  const registered: HTMLElement[] = [];
  if (getOwner() !== null) {
    onCleanup(() => {
      for (const element of registered) registry.get(handle)?.delete(element);
    });
  }
  return (element) => {
    let elements = registry.get(handle);
    if (!elements) registry.set(handle, (elements = new Set()));
    elements.add(element);
    registered.push(element);
  };
}

/** Records the `<form>` element of `store`. */
export function registerFormElement(store: object, element: HTMLFormElement): void {
  formElements.set(store, element);
}

/** The `<form>` element of `store`, while it is in the document. */
export function formElementOf(store: object): HTMLFormElement | undefined {
  const element = formElements.get(store);
  return element?.isConnected ? element : undefined;
}
