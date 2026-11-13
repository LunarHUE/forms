import type { Path } from "../path.js";
import type { PluginContext } from "../plugin.js";
import { ownKeys } from "./baseline/equality.js";
import { sameList } from "./entries.js";
import { freeze } from "./freeze.js";
import { childOf, isPlainObject } from "./tree.js";

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

/**
 * Moves the baseline of the subtree at `path` to `incoming`, and lets
 * `resolve` pick the value of each leaf that differs. Returns the paths it
 * wrote. Call it inside `ctx.write`. The `rebase` and `bind` plugins share it.
 */
export function rebaseTo(ctx: Pick<PluginContext, "store" | "baseline">, path: string[], incoming: unknown, resolve: Resolve): Path[] {
  const { store, baseline } = ctx;
  const taken: Path[] = [];
  const old = baseline.read(path);
  if (!old) return taken;
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

  visit(path, store.getSnapshot(path).value, incoming, old.value);
  baseline.move(path, incoming, kept.size > 0 ? keep : undefined);
  return taken;
}
