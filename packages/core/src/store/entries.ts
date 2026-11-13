import type { FieldSnapshot, FieldSnapshotBase } from "../snapshot.js";
import { freeze } from "./freeze.js";

/** A field snapshot as the store core makes it. */
export type Snapshot<E = unknown> = FieldSnapshot<unknown, E>;

/** The members of a field snapshot that come from per-field state rather than the value. */
export type FieldState<E> = Omit<FieldSnapshotBase<unknown, E>, "value" | "name">;

/** The one empty list every snapshot uses. */
export const none: readonly never[] = freeze([]);

/** The state of a field nothing has touched. */
export const idle: FieldState<never> = {
  errors: none,
  shownErrors: none,
  invalid: false,
  touched: false,
  edited: false,
  dirty: false,
  validating: false,
  disabled: false,
  readOnly: false,
};

/**
 * The members of a field's snapshot, unfrozen, from the field's value, name
 * and state. `keys` is the item key list when the value is an array. A
 * missing value gets an empty `keys` list, since the store can't tell
 * whether a missing field is an array.
 */
export function entries<E>(value: unknown, name: string, keys: readonly string[] | undefined, state: FieldState<E>): Snapshot<E> {
  const base = { value, name, ...state };
  if (keys) return { ...base, keys };
  if (value === undefined || value === null) return { ...base, keys: none };
  return base;
}

function sameMembers(a: object, b: object): boolean {
  for (const member in a) if (!Object.is(Reflect.get(a, member), Reflect.get(b, member))) return false;
  for (const member in b) if (!(member in a)) return false;
  return true;
}

/** A placeholder for a node's snapshot until its first one is built. */
export const blank: Snapshot<never> = entries(undefined, "", undefined, idle);

/**
 * Returns `candidate`, or an earlier object whose members all equal it, so
 * `===` tells whether anything changed. `previous` is the current one.
 * `before` is the one listeners last saw, so a change that is undone before
 * they run gets that object back.
 */
export function settle<S extends object>(candidate: S, previous: S | undefined, before?: S): S {
  if (previous && sameMembers(candidate, previous)) return previous;
  if (before && sameMembers(candidate, before)) return before;
  return freeze(candidate);
}

/** True when both lists hold the same elements in the same order, by `Object.is`. */
export function sameList(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

/**
 * A copy of `list` for a snapshot, frozen in development, so the caller's
 * array is never frozen and later changes to it can't reach the snapshot.
 * An empty list is always `none`.
 */
export function listOf<E>(list: readonly E[]): readonly E[] {
  if (list.length === 0) return none;
  return freeze(list.slice());
}
