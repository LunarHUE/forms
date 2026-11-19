import type { FieldSnapshot, Needs, PluginsOf } from "@lunarhue/forms-core";
import { createElement, Fragment, type ReactElement, type ReactNode, useMemo } from "react";
import type { ArrayHandleLike } from "./field.js";
import { useSelected } from "./select.js";
import { fieldSource } from "./sources.js";

/**
 * An array handle of a form with `arrays()`. For one without it, a type with
 * the key "Add arrays() to this form's plugins", so passing it is an error
 * that says what to install.
 */
type ListHandle<H extends ArrayHandleLike> = H & Needs<PluginsOf<H>, "arrays", unknown>;

const noKeys: readonly string[] = [];
const keysOf = (snapshot: FieldSnapshot<unknown, unknown>): readonly string[] => snapshot.keys ?? noKeys;
const sameKeys = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((key, index) => key === b[index]);

/**
 * Returns the item handles of an array field, in their current order. The
 * component re-renders only when the item keys change: an item added,
 * removed or moved. An edit inside an item does not re-render it. The list
 * keeps its identity until the keys change, so it is safe as a dependency.
 * The form needs `arrays()`.
 */
export const useItems = <H extends ArrayHandleLike>(handle: ListHandle<H>): readonly ReturnType<H["item"]>[] => {
  const keys = useSelected(fieldSource(handle), keysOf, sameKeys);
  // `item` returns the handle typed for the array's items.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return useMemo(() => keys.map((key) => handle.item(key)), [handle, keys]) as ReturnType<H["item"]>[];
};

/** Props of `Items`. */
export interface ItemsProps<H extends ArrayHandleLike> {
  /** The array field. Its form needs `arrays()`. */
  readonly handle: ListHandle<H>;
  /** Renders one item. Each result is keyed by the item's stable key. */
  readonly children: (item: ReturnType<H["item"]>, index: number) => ReactNode;
}

/**
 * Renders one child per item of an array field, keyed by the item's stable
 * key. It re-renders when items are added, removed or moved, not when a
 * value inside an item changes. The form needs `arrays()`.
 */
export function Items<H extends ArrayHandleLike>(props: ItemsProps<H>): ReactElement {
  const items = useItems<H>(props.handle);
  const { children } = props;
  return createElement(
    Fragment,
    null,
    // Every item handle has a `key`; `ArrayHandleLike` only promises `item`.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    items.map((item, index) => createElement(Fragment, { key: (item as { readonly key: string }).key }, children(item, index))),
  );
}
