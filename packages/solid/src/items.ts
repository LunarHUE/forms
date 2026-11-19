import type { Needs, PluginsOf } from "@lunarhue/forms-core";
import { createMemo, isServer } from "#solid";
import { createComponent, For, getOwner, untrack, type Accessor } from "solid-js";
import type { SolidElement } from "./element.js";
import type { ArrayHandleLike } from "./field.js";
import { fieldReader } from "./reader.js";

/**
 * An array handle of a form with `arrays()`. For one without it, a type with
 * the key "Add arrays() to this form's plugins", so passing it is an error
 * that says what to install.
 */
type ListHandle<H extends ArrayHandleLike> = H & Needs<PluginsOf<H>, "arrays", unknown>;

const noKeys: readonly string[] = [];

/** True when two key lists hold the same keys in the same order. */
function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((key, index) => key === b[index]);
}

/** See `createItems`. */
function createItemList(handle: ArrayHandleLike): () => readonly unknown[] {
  const read = fieldReader(handle);
  const keysNow = () => read().keys ?? noKeys;
  const itemsOf = (keys: readonly string[]) => keys.map((key) => handle.item(key));
  if (getOwner() === null) return () => itemsOf(keysNow());
  // An edit inside an item gives the array a new snapshot with the same keys. The first memo stops there.
  const keys = createMemo(keysNow, { equals: sameKeys });
  return createMemo(() => itemsOf(keys()));
}

/**
 * Returns the item handles of an array field, in their current order, as an
 * accessor. It is a memo over the field's `keys`, so it changes only when an
 * item is added, removed or moved, never on an edit inside an item. Each key
 * maps to the same handle object every time, so `<For each={items()}>`
 * keeps a row's DOM through inserts, removes and moves. The form needs
 * `arrays()`.
 */
export const createItems: <H extends ArrayHandleLike>(handle: ListHandle<H>) => Accessor<readonly ReturnType<H["item"]>[]> =
  // Each entry is what `handle.item` returns, which the type names.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  createItemList as never;

/** Props of `Items`. */
export interface ItemsProps<H extends ArrayHandleLike> {
  /** The array field. Its form needs `arrays()`. */
  readonly handle: ListHandle<H>;
  /** Shown while the array has no items. */
  readonly fallback?: SolidElement;
  /**
   * Renders one item. Runs once per item key, so the row keeps its DOM when
   * items are added, removed or moved. `index` follows the item's position.
   */
  readonly children: (item: ReturnType<H["item"]>, index: Accessor<number>) => SolidElement;
}

/** `For` keyed by item identity: each item handle is its own key. */
const ForEach: (props: {
  readonly each: readonly unknown[];
  readonly fallback?: SolidElement;
  readonly children: (item: unknown, index: Accessor<number>) => SolidElement;
}) => SolidElement = For;

/**
 * Focuses the focused element again after the current reconcile if the
 * reconcile blurred it. `For` moves a row with insertBefore on Solid 1, and on
 * Solid 2 in a browser without moveBefore. The row leaves the document for a
 * moment, and a focused element in it loses focus.
 */
function keepFocus(): void {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && focused !== document.body)
    queueMicrotask(() => {
      if (focused.isConnected && document.activeElement === document.body) focused.focus({ preventScroll: true });
    });
}

/**
 * Renders an array field's items with `For`, keyed by core's stable item
 * keys. `item` is the item handle: render its fields with
 * `<form.Field handle={item.at("qty")}>`. The form needs `arrays()`.
 */
export function Items<H extends ArrayHandleLike>(props: ItemsProps<H>): SolidElement {
  // The handle is read once, as the bound components read theirs.
  const items = createItemList(untrack(() => props.handle));
  return createComponent(ForEach, {
    get each() {
      if (!isServer) keepFocus();
      return items();
    },
    get fallback() {
      return props.fallback;
    },
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    children: (item: unknown, index: Accessor<number>) => props.children(item as ReturnType<H["item"]>, index),
  });
}
