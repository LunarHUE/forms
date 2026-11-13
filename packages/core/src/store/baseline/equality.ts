import type { Equals } from "../../definition.js";
import type { Path } from "../../path.js";
import { childOf, hasOwn, isContainer, isPlainObject } from "../tree.js";
import { childKeys, itemKey, type KeyTrie } from "./keys.js";

/**
 * Core's default comparison: `Object.is` on primitives, dates by timestamp,
 * plain objects key by key with a missing key equal to undefined, arrays in
 * order, and everything else by reference.
 */
export function defaultEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return Object.is(a.getTime(), b.getTime());
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => defaultEquals(item, b[i]));
  if (isPlainObject(a) && isPlainObject(b)) return ownKeys(a, b).every((key) => defaultEquals(childOf(a, key), childOf(b, key)));
  return false;
}

/** `a`'s keys, then the keys only `b` has. */
export function ownKeys(a: object, b: object): string[] {
  const keys = Object.keys(a);
  for (const key of Object.keys(b)) if (!hasOwn(a, key)) keys.push(key);
  return keys;
}

/**
 * Compares `a` with `b` at stable path `path`. `keys` holds the item keys of
 * the arrays in `b`, which name the items in the paths `equals` gets.
 */
export type Compare = (path: Path, a: unknown, b: unknown, keys: KeyTrie | undefined) => boolean;

/** The equality chains of one form. */
export interface Equality {
  readonly compare: Compare;
  /** Forgets cached results. Call it when the key trie changes. */
  readonly forget: () => void;
}

interface Memo {
  readonly b: unknown;
  readonly id: string;
  readonly result: boolean;
}

/**
 * Makes the chain `form`, then `shared`, then the default. The default
 * compares containers child by child through the whole chain, so `equals`
 * is asked at every path it reaches.
 *
 * Two values that are the same reference are equal without asking anything.
 * That is what keeps a write cheap: untouched branches are shared with the
 * baseline and skipped. Results for containers are cached by both values and
 * the path, so the store asking again for an ancestor reuses the answer. Each
 * container also remembers the child it last found different and checks that
 * one first, so a container that stays dirty answers after one child.
 */
export function createEquality(form: Equals | undefined, shared: Equals | undefined): Equality {
  let memo = new WeakMap<object, Memo>();
  // Keyed by the right-hand value, which is the baseline in dirty checks and so stays put.
  const hints = new WeakMap<object, string | number>();

  const chain = (path: Path, a: unknown, b: unknown, base: (a: unknown, b: unknown) => boolean): boolean => {
    const ctx = { path };
    const afterForm = shared ? (x: unknown, y: unknown) => shared(x, y, ctx, base) : base;
    return form ? form(a, b, ctx, afterForm) : afterForm(a, b);
  };

  const structural = (path: Path, a: unknown, b: unknown, keys: KeyTrie | undefined): boolean => {
    if (Object.is(a, b)) return true;
    if (a instanceof Date && b instanceof Date) return Object.is(a.getTime(), b.getTime());
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      const same = (i: number) => {
        const x: unknown = a[i];
        const y: unknown = b[i];
        if (Object.is(x, y)) return true;
        const key = itemKey(keys, i);
        return compare([...path, key], x, y, childKeys(keys, key));
      };
      const hint = hints.get(b);
      if (typeof hint === "number" && hint < a.length && !same(hint)) return false;
      for (let i = 0; i < a.length; i++) {
        if (i === hint || same(i)) continue;
        hints.set(b, i);
        return false;
      }
      return true;
    }
    if (isPlainObject(a) && isPlainObject(b)) {
      const same = (key: string) => {
        const x = childOf(a, key);
        const y = childOf(b, key);
        return Object.is(x, y) || compare([...path, key], x, y, childKeys(keys, key));
      };
      const hint = hints.get(b);
      if (typeof hint === "string" && !same(hint)) return false;
      for (const key of ownKeys(a, b)) {
        if (key === hint || same(key)) continue;
        hints.set(b, key);
        return false;
      }
      return true;
    }
    return false;
  };

  const compare: Compare = (path, a, b, keys) => {
    if (Object.is(a, b)) return true;
    if (!isContainer(a)) return chain(path, a, b, (x, y) => structural(path, x, y, keys));
    const id = JSON.stringify(path);
    const hit = memo.get(a);
    if (hit && hit.id === id && Object.is(hit.b, b)) return hit.result;
    const result = chain(path, a, b, (x, y) => structural(path, x, y, keys));
    memo.set(a, { b, id, result });
    return result;
  };

  return {
    compare,
    forget: () => {
      memo = new WeakMap();
    },
  };
}
