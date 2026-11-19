import { createMemo, getOwner } from "solid-js";
import type { ArrayHandleLike } from "./field.js";
import { fieldReader } from "./reader.js";

const noKeys: readonly string[] = [];

/** True when two key lists hold the same keys in the same order. */
function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((key, index) => key === b[index]);
}

/** See `createItems`. */
export function createItemList(handle: ArrayHandleLike): () => readonly unknown[] {
  const read = fieldReader(handle);
  const keysNow = () => read().keys ?? noKeys;
  const itemsOf = (keys: readonly string[]) => keys.map((key) => handle.item(key));
  if (getOwner() === null) return () => itemsOf(keysNow());
  // An edit inside an item gives the array a new snapshot with the same keys. The first memo stops there.
  const keys = createMemo(keysNow, { equals: sameKeys });
  return createMemo(() => itemsOf(keys()));
}
