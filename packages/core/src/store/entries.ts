import type { FieldSnapshot } from "../snapshot.js";
import { dev } from "./freeze.js";

/** A field snapshot as the store core makes it. No error type yet, so its error lists are `never[]`. */
export type Snapshot = FieldSnapshot<unknown, never>;

const none: readonly never[] = dev ? Object.freeze([]) : [];

/**
 * The members later steps fill from per-field state. Until then every field
 * has these values. Step 3 replaces each one with its own source.
 */
const idle = {
  errors: none,
  shownErrors: none,
  invalid: false,
  touched: false,
  edited: false,
  dirty: false,
  validating: false,
  disabled: false,
  readOnly: false,
} as const;

/**
 * The members of a field's snapshot, unfrozen, from what the store knows
 * about the field. `keys` is the item key list when the value is an array.
 * A missing value gets an empty `keys` list, since the store can't tell
 * whether a missing field is an array.
 */
export function entries(value: unknown, name: string, keys: readonly string[] | undefined): Snapshot {
  const base = { value, name, ...idle };
  if (keys) return { ...base, keys };
  if (value === undefined || value === null) return { ...base, keys: none };
  return base;
}

function sameMembers(a: Snapshot, b: Snapshot): boolean {
  if ("keys" in a !== "keys" in b) return false;
  for (const member in a) if (!Object.is(Reflect.get(a, member), Reflect.get(b, member))) return false;
  return true;
}

/** A placeholder for a node's snapshot until its first one is built. */
export const blank: Snapshot = entries(undefined, "", undefined);

/**
 * Returns `candidate` as a snapshot, or an earlier snapshot whose members
 * all equal it, so `===` tells whether anything changed. `previous` is the
 * current snapshot. `before` is the one listeners last saw, so a change that
 * is undone before they run gets that snapshot back.
 */
export function settle(candidate: Snapshot, previous: Snapshot | undefined, before: Snapshot | undefined): Snapshot {
  if (previous && sameMembers(candidate, previous)) return previous;
  if (before && sameMembers(candidate, before)) return before;
  return dev ? Object.freeze(candidate) : candidate;
}
