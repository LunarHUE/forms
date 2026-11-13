import type { Path } from "../../path.js";

/** The pattern segment that matches any item of an array. */
export const item: unique symbol = Symbol("item");

/** A stable path where a segment can be `item`, for validators declared over every array item. */
export type Pattern = readonly (string | typeof item)[];

export { keyOf } from "../placed.js";

/** True when `path` starts with `prefix`. */
export const startsWith = (path: Path, prefix: Path): boolean =>
  prefix.length <= path.length && prefix.every((seg, i) => String(seg) === String(path[i]));

/** True when the first `length` segments of `path` match `pattern`, which must be at least that long. */
export const matches = (pattern: Pattern, path: Path, length: number): boolean => {
  for (let i = 0; i < length; i++) {
    const seg = pattern[i];
    if (seg !== item && seg !== String(path[i])) return false;
  }
  return true;
};

/** True when the pattern has no `item` segment, so it names one field. */
export const isConcrete = (pattern: Pattern): pattern is readonly string[] => !pattern.includes(item);

/** A trie of values by stable path. */
export interface Slot<T> {
  children: Map<string, Slot<T>> | undefined;
  values: Set<T> | undefined;
}

export const slot = <T>(): Slot<T> => ({ children: undefined, values: undefined });

/** The slot at `path`, made when `create` is true. */
export function slotAt<T>(root: Slot<T>, path: Path, create: true): Slot<T>;
export function slotAt<T>(root: Slot<T>, path: Path, create: false): Slot<T> | undefined;
export function slotAt<T>(root: Slot<T>, path: Path, create: boolean): Slot<T> | undefined {
  let at = root;
  for (const segment of path) {
    const seg = String(segment);
    let next = at.children?.get(seg);
    if (!next) {
      if (!create) return undefined;
      (at.children ??= new Map()).set(seg, (next = slot()));
    }
    at = next;
  }
  return at;
}

/** Removes `value` from the slot at `path` and drops slots left empty. */
export function removeAt<T>(root: Slot<T>, path: Path, value: T): void {
  const trail: Slot<T>[] = [root];
  for (const segment of path) {
    const next = trail[trail.length - 1]?.children?.get(String(segment));
    if (!next) return;
    trail.push(next);
  }
  const last = trail[trail.length - 1];
  last?.values?.delete(value);
  for (let i = trail.length - 1; i > 0; i--) {
    const at = trail[i];
    if (!at || (at.values?.size ?? 0) > 0 || (at.children?.size ?? 0) > 0) return;
    trail[i - 1]?.children?.delete(String(path[i - 1]));
  }
}

/** Adds the values at every prefix of `path`, root first, ending with `path` itself when `self` is true. */
export function along<T>(root: Slot<T>, path: Path, self: boolean, out: Set<T>): void {
  let at: Slot<T> | undefined = root;
  const end = self ? path.length : path.length - 1;
  for (let i = 0; at && i <= end; i++) {
    if (at.values) for (const value of at.values) out.add(value);
    if (i < path.length) at = at.children?.get(String(path[i]));
  }
}

/** Adds the values in the slot's subtree, the slot's own included when `self` is true. */
export function below<T>(at: Slot<T> | undefined, self: boolean, out: Set<T>): void {
  if (!at) return;
  if (self && at.values) for (const value of at.values) out.add(value);
  at.children?.forEach((child) => below(child, true, out));
}
