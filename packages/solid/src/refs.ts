import { getOwner, onCleanup } from "solid-js";

/** The elements registered for each field, by store and then by handle id. */
const registry = new WeakMap<object, Map<string, HTMLElement[]>>();

/** The `<form>` element of each store, from `formProps.ref`. */
const formElements = new WeakMap<object, HTMLFormElement>();

/** Adds `element` as a focus target of the field `id` in `store`. Returns the function that removes it. */
export function registerElement(store: object, id: string, element: HTMLElement): () => void {
  let byId = registry.get(store);
  if (!byId) {
    byId = new Map();
    registry.set(store, byId);
  }
  const list = byId.get(id) ?? [];
  if (!list.includes(element)) list.push(element);
  byId.set(id, list);
  const elements = byId;
  return () => {
    const rest = (elements.get(id) ?? []).filter((each) => each !== element);
    if (rest.length > 0) elements.set(id, rest);
    else elements.delete(id);
  };
}

/** The elements registered for the field `id` in `store` that are still in the document. */
export function elementsOf(store: object, id: string): HTMLElement[] {
  const list = registry.get(store)?.get(id) ?? [];
  return list.filter((element) => element.isConnected);
}

/**
 * Returns a ref callback that registers each element it gets for the field
 * `id`. Every element it registered is removed when the current owner is
 * disposed. Ref callbacks run with no owner, so the cleanup is taken here.
 */
export function elementRegistrar(store: object, id: string): (element: HTMLElement) => void {
  const removers: (() => void)[] = [];
  if (getOwner() !== null) {
    onCleanup(() => {
      for (const remove of removers) remove();
    });
  }
  return (element) => {
    removers.push(registerElement(store, id, element));
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
