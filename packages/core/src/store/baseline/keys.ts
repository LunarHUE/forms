import type { Path } from "../../path.js";
import { initialIndex, keyAt } from "../keys.js";
import { childOf, isPlainObject } from "../tree.js";

/** The item keys of one baseline array, with each key's index. */
export interface KeyIndex {
  /** The keys in item order. Undefined for an item no current item pairs with. */
  readonly keys: readonly (string | undefined)[];
  readonly index: ReadonlyMap<string, number>;
}

/**
 * The item keys of the arrays in a baseline value, by stable path. An array
 * with no entry has the positional keys `k0`, `k1`, ..., the keys the store
 * gives an array it hasn't changed.
 */
export interface KeyTrie {
  /** The keys of the array here, when they aren't the positional ones. */
  list: KeyIndex | undefined;
  children: Map<string, KeyTrie> | undefined;
}

/** Item keys for an array of some length, from a key source. */
export type KeysFor = (path: Path, length: number) => readonly (string | undefined)[];

export const childKeys = (trie: KeyTrie | undefined, key: string | number): KeyTrie | undefined =>
  trie?.children?.get(String(key));

/** The key of item `index`. An item without a key gets its index, which names no stable path. */
export const itemKey = (trie: KeyTrie | undefined, index: number): string | number =>
  (trie?.list ? trie.list.keys[index] : keyAt(undefined, index)) ?? index;

/** The index of the item with key `key` in an array of `length` items, or -1. */
export const indexOfItem = (trie: KeyTrie | undefined, key: string, length: number): number =>
  trie?.list ? (trie.list.index.get(key) ?? -1) : initialIndex(key, length);

/** The keys of an array of `length` items, as listed or positional. */
export function keysOf(trie: KeyTrie | undefined, length: number): readonly (string | undefined)[] {
  return trie?.list ? trie.list.keys : Array.from({ length }, (_, i) => keyAt(undefined, i));
}

/** `keys` cut or padded with undefined to `length`. */
export function fit(keys: readonly (string | undefined)[], length: number): (string | undefined)[] {
  const out = keys.slice(0, length);
  while (out.length < length) out.push(undefined);
  return out;
}

/** A key index, or undefined when the keys are the positional ones. */
export function indexKeys(keys: readonly (string | undefined)[]): KeyIndex | undefined {
  if (keys.every((key, i) => key === keyAt(undefined, i))) return undefined;
  const index = new Map<string, number>();
  keys.forEach((key, i) => {
    if (key !== undefined) index.set(key, i);
  });
  return { keys, index };
}

/** The value at stable path `path` in `root`, and the key trie there. */
export function locate(root: unknown, trie: KeyTrie | undefined, path: Path): { value: unknown; keys: KeyTrie | undefined } {
  let value = root;
  let keys = trie;
  for (const segment of path) {
    const seg = String(segment);
    if (Array.isArray(value)) {
      const index = indexOfItem(keys, seg, value.length);
      value = index >= 0 ? value[index] : undefined;
    } else value = isPlainObject(value) ? childOf(value, seg) : undefined;
    keys = childKeys(keys, seg);
  }
  return { value, keys };
}

/** Builds a key trie. See `buildKeys`. */
export type BuildKeys = (path: Path, value: unknown, keysFor: KeysFor) => KeyTrie | undefined;

/**
 * The key trie for `value` at `path`, taking each array's keys from
 * `keysFor`. Undefined when every key is positional. `arrays()` brings it.
 */
export function buildKeys(path: Path, value: unknown, keysFor: KeysFor): KeyTrie | undefined {
  let children: Map<string, KeyTrie> | undefined;
  const add = (seg: string, child: unknown) => {
    const built = buildKeys([...path, seg], child, keysFor);
    if (built) (children ??= new Map()).set(seg, built);
  };
  let list: KeyIndex | undefined;
  if (Array.isArray(value)) {
    const keys = fit(keysFor(path, value.length), value.length);
    list = indexKeys(keys);
    keys.forEach((key, i) => {
      if (key !== undefined) add(key, value[i]);
    });
  } else if (isPlainObject(value)) for (const key of Object.keys(value)) add(key, value[key]);
  return list || children ? { list, children } : undefined;
}
