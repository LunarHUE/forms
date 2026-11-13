import type { HandleBase } from "../handle.js";
import type { Path } from "../path.js";
import type { HookPlugin } from "../plugin.js";
import { definePlugin } from "../plugins.js";
import { ownKeys } from "../store/baseline/equality.js";
import { sameList } from "../store/entries.js";
import { freeze } from "../store/freeze.js";
import { childOf, isPlainObject } from "../store/tree.js";

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
  /** The stable paths written by `"take"` or `{ value }`. They are revalidated when the store has validation. */
  readonly taken: readonly Path[];
}

/**
 * Moves the baseline of the subtree at `handle` to `incoming`. Leaves whose
 * current value equals the incoming one just move their baseline. For every
 * other leaf `resolve` decides the value. Listeners run once, after the
 * whole rebase. The handle must belong to the store the plugin is on.
 */
// Generic in the error type rather than taking `HandleBase<unknown, unknown>`:
// whether a handle with a concrete error type is assignable to that depended
// on the order the checker met the types in.
export type Rebase = <V, E>(handle: HandleBase<V, E>, incoming: NoInfer<V>, resolve: Resolve) => RebaseResult;

/**
 * The rebase plugin. Its API is `form.plugins.rebase`, a `Rebase`.
 *
 * Objects are walked key by key. An array is walked item by item when its
 * items still have the keys and order of its baseline and the incoming
 * array has as many items. Otherwise it is one leaf.
 *
 * After it, each array's items pair with the incoming items by index: with
 * the baseline's keys where the leaf was kept, and with the current keys
 * everywhere else, so a leaf that was taken or already equal isn't dirty.
 * Writes are not user edits, and their records have `cause: "rebase"`.
 */
export function rebase(): HookPlugin<Rebase, "rebase"> {
  return definePlugin({
    name: "rebase",
    setup(ctx) {
      const { store, baseline } = ctx;
      const api: Rebase = (handle, incoming, resolve) => {
        if (handle.store !== store) throw new TypeError("rebase: the handle belongs to another store");
        const path = handle.path.map(String);
        const old = baseline.read(path);
        const taken: Path[] = [];
        if (!old) return freeze({ taken: freeze(taken) });
        const kept = new Set<string>();

        const visit = (at: string[], value: unknown, next: unknown, before: unknown) => {
          if (baseline.equals(at, value, next)) return;
          if (isPlainObject(value) && isPlainObject(next)) {
            const held = isPlainObject(before) ? before : {};
            for (const key of ownKeys(value, next)) visit([...at, key], childOf(value, key), childOf(next, key), childOf(held, key));
            return;
          }
          if (Array.isArray(value) && Array.isArray(next) && Array.isArray(before)) {
            const current = store.getSnapshot(at).keys ?? [];
            if (value.length === next.length && sameList(current, baseline.read(at)?.keys ?? [])) {
              current.forEach((key, i) => visit([...at, key], value[i], next[i], before[i]));
              return;
            }
          }
          const choice = resolve({ path: freeze(at), value, baseline: before, incoming: next, edited: store.getSnapshot(at).edited });
          if (choice === "keep") {
            kept.add(JSON.stringify(at));
            return;
          }
          const written = choice === "take" ? next : choice.value;
          // A function would be read as an updater, so it goes through one.
          store.fieldAt(at)?.setValue(() => written, { replace: true, edited: false });
          taken.push(freeze(at));
        };

        // Arrays at or under a kept leaf keep the baseline's keys.
        const keep = (at: Path) => {
          for (let end = path.length; end <= at.length; end++) if (kept.has(JSON.stringify(at.slice(0, end)))) return true;
          return false;
        };

        // Called from inside another plugin's hook, this waits for the round to
        // end, and the result lists nothing taken yet.
        ctx.write(() => {
          visit(path, store.getSnapshot(path).value, incoming, old.value);
          baseline.move(path, incoming, kept.size > 0 ? keep : undefined);
        });
        return freeze({ taken: freeze([...taken]) });
      };
      return { api };
    },
  });
}
