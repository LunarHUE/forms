import { dev } from "./freeze.js";

/** The stable item keys of one array, in item order. */
export interface KeyList {
  /** The keys in item order. */
  readonly keys: string[];
  /** The number in the next fresh key. */
  next: number;
  /** Each key's index. Dropped when the order changes and rebuilt on the next lookup. */
  positions: Map<string, number> | undefined;
  /** The copy of `keys` that snapshots hand out. Made again after a change. */
  view: readonly string[] | undefined;
}

/** The key an item at `index` gets when its array's key list is made. */
const keyFor = (index: number) => `k${index}`;

/**
 * Makes the key list of an array of `length` items. Keys made here are
 * positional (`k0`, `k1`, ...), so two stores made from the same value agree
 * on them whatever order they read in. Later keys come from the list's own
 * counter and are never reused.
 */
export function createKeyList(length: number): KeyList {
  return { keys: Array.from({ length }, (_, i) => keyFor(i)), next: length, positions: undefined, view: undefined };
}

/** The positional keys of an array of `length` items, as `createKeyList` makes them. */
export function initialKeys(length: number): readonly string[] {
  return createKeyList(length).keys;
}

/** The index `key` had when its list was made for an array of `length` items, or -1. */
export function initialIndex(key: string, length: number): number {
  const match = /^k(0|[1-9]\d*)$/.exec(key);
  const index = match ? Number(match[1]) : -1;
  return index < length ? index : -1;
}

function changed(list: KeyList): void {
  list.positions = undefined;
  list.view = undefined;
}

/** The index of `key`, or -1 when the list doesn't have it. */
export function indexOfKey(list: KeyList, key: string): number {
  if (!list.positions) {
    const positions = new Map<string, number>();
    list.keys.forEach((k, i) => positions.set(k, i));
    list.positions = positions;
  }
  return list.positions.get(key) ?? -1;
}

/**
 * Fits the list to an array of `length` items after the whole array was
 * replaced. Keys stay with their index: surplus keys are dropped from the
 * end and new items at the end get fresh keys. Returns the dropped keys.
 */
export function resizeKeys(list: KeyList, length: number): string[] {
  const dropped = list.keys.splice(length);
  const grow = list.keys.length < length;
  while (list.keys.length < length) list.keys.push(keyFor(list.next++));
  if (grow || dropped.length > 0) changed(list);
  return dropped;
}

/** Adds a fresh key at `index` and returns it. */
export function insertKey(list: KeyList, index: number): string {
  const key = keyFor(list.next++);
  list.keys.splice(index, 0, key);
  changed(list);
  return key;
}

/** Takes the key at `index` out and returns it. */
export function removeKey(list: KeyList, index: number): string | undefined {
  const [key] = list.keys.splice(index, 1);
  changed(list);
  return key;
}

/** Moves the key at `from` to `to`. */
export function moveKey(list: KeyList, from: number, to: number): void {
  const [key] = list.keys.splice(from, 1);
  if (key !== undefined) list.keys.splice(to, 0, key);
  changed(list);
}

/** The keys as an immutable array. The same array until the list changes. */
export function keysView(list: KeyList): readonly string[] {
  list.view ??= dev ? Object.freeze(list.keys.slice()) : list.keys.slice();
  return list.view;
}
