import type { HandleBase } from "./handle.js";
import type { Path } from "./path.js";
import { ownKeys } from "./store/baseline/equality.js";
import { childKeys, keysOf, locate, type KeysFor, type KeyTrie } from "./store/baseline/keys.js";
import { partsOf } from "./store/baseline/registry.js";
import { sameList } from "./store/entries.js";
import { dev } from "./store/freeze.js";
import { childOf, isPlainObject } from "./store/tree.js";

/** One leaf whose current value differs from the incoming one. `Resolve` decides what it becomes. */
export interface RebaseLeaf {
  /** The leaf's stable path. */
  readonly path: Path;
  /** The current value. */
  readonly value: unknown;
  /** The baseline before the rebase. */
  readonly baseline: unknown;
  /** The value arriving from outside, such as a fresh server copy. */
  readonly incoming: unknown;
  /** True when the leaf has had a user edit. */
  readonly edited: boolean;
}

/**
 * What a leaf becomes. `"keep"` keeps the current value. `"take"` writes the
 * incoming value. `{ value }` writes that value.
 */
export type RebaseChoice = "keep" | "take" | { readonly value: unknown };

/** Picks a `RebaseChoice` for one differing leaf. */
export type Resolve = (leaf: RebaseLeaf) => RebaseChoice;

/** What a rebase did. */
export interface RebaseResult {
  /** The stable paths written by `"take"` or `{ value }`. Core revalidates them. */
  readonly taken: readonly Path[];
}

/**
 * Moves the baseline of the subtree at `handle` to `incoming`. Leaves whose
 * current value equals the incoming one just move their baseline. For every
 * other leaf `resolve` decides the value. Listeners run once, after the
 * whole rebase.
 */
// Generic in the error type rather than taking `HandleBase<unknown, unknown>`:
// whether a handle with a concrete error type is assignable to that depended
// on the order the checker met the types in.
export type Rebase = <V, E>(handle: HandleBase<V, E>, incoming: NoInfer<V>, resolve: Resolve) => RebaseResult;

const freeze = <T extends object>(value: T): T => (dev ? Object.freeze(value) : value);

/**
 * Implements `Rebase`. Objects are walked key by key. An array is walked item
 * by item when its items still have the keys and order of its baseline and
 * the incoming array has as many items. Otherwise it is one leaf.
 *
 * After it, each array's items pair with the incoming items by index: with
 * the baseline's keys where the leaf was kept, and with the current keys
 * everywhere else, so a leaf that was taken or already equal isn't dirty.
 */
export const rebase: Rebase = (handle, incoming, resolve) => {
  const parts = partsOf(handle.store);
  if (!parts) throw new TypeError("rebase: the handle does not belong to a form store");
  const { core, baseline, validation } = parts;
  const path = handle.path.map(String);
  if (!core.isLive(path)) return freeze({ taken: freeze([]) });

  return core.batch(() => {
    const taken: Path[] = [];
    const kept = new Set<string>();
    const old = baseline.locate(path);

    const visit = (at: string[], value: unknown, next: unknown, before: unknown, keys: KeyTrie | undefined) => {
      if (baseline.compare(at, value, next, keys)) return;
      if (isPlainObject(value) && isPlainObject(next)) {
        const held = isPlainObject(before) ? before : {};
        for (const key of ownKeys(value, next))
          visit([...at, key], childOf(value, key), childOf(next, key), childOf(held, key), childKeys(keys, key));
        return;
      }
      if (Array.isArray(value) && Array.isArray(next) && Array.isArray(before)) {
        const current = core.getSnapshot(at).keys ?? [];
        const same = value.length === next.length && sameList(current, keysOf(keys, before.length));
        if (same) {
          current.forEach((key, i) => visit([...at, key], value[i], next[i], before[i], childKeys(keys, key)));
          return;
        }
      }
      const choice = resolve({ path: freeze(at), value, baseline: before, incoming: next, edited: core.getSnapshot(at).edited });
      if (choice === "keep") {
        kept.add(JSON.stringify(at));
        return;
      }
      core.set(at, choice === "take" ? next : choice.value);
      taken.push(freeze(at));
    };

    // Arrays at or under a kept leaf keep the baseline's keys. The rest take the current ones.
    const keysFor: KeysFor = (at, length) => {
      if (kept.size > 0)
        for (let end = path.length; end <= at.length; end++) {
          if (!kept.has(JSON.stringify(at.slice(0, end)))) continue;
          const before = locate(old.value, old.keys, at.slice(path.length));
          return Array.isArray(before.value) ? keysOf(before.keys, before.value.length) : [];
        }
      return baseline.currentKeys(at, length);
    };

    visit(path, core.getSnapshot(path).value, incoming, old.value, old.keys);
    baseline.move(path, incoming, keysFor);
    core.recheckDirty();
    if (taken.length > 0) validation.changed(taken);
    return freeze({ taken: freeze(taken) });
  });
};
