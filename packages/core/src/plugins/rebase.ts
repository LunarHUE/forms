import type { HandleBase } from "../handle.js";
import type { Path } from "../path.js";
import type { Plugin } from "../plugin.js";
import { defineHooks } from "../store/define.js";
import { problem } from "../problem.js";
import { freeze } from "../store/freeze.js";
import { rebaseTo, type Resolve } from "../store/rebase.js";
import type { DeepReadonly } from "../value.js";

export type { RebaseChoice, RebaseLeaf, Resolve } from "../store/rebase.js";

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
// `incoming` may be readonly, as a snapshot's value is. Rebase never writes into it.
export type Rebase = <V, E>(handle: HandleBase<V, E>, incoming: NoInfer<V | DeepReadonly<V>>, resolve: Resolve) => RebaseResult;

/**
 * The rebase plugin. Its API is `form.plugins.rebase`, a `Rebase`.
 *
 * Values are compared by the form's dirty comparison when `dirty()` is
 * installed, and by `Object.is` alone when it isn't.
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
export function rebase(): Plugin<Rebase, "rebase"> {
  return defineHooks({
    name: "rebase",
    setup(ctx) {
      const { store } = ctx;
      const api: Rebase = (handle, incoming, resolve) => {
        if (handle.store !== store) {
          throw new TypeError(problem("rebase:store"));
        }
        let taken: Path[] = [];
        // Called from inside another plugin's hook, this waits for the round to
        // end, and the result lists nothing taken yet.
        ctx.write(() => {
          taken = rebaseTo(ctx, handle.path.map(String), incoming, resolve);
        }, "rebase");
        return freeze({ taken: freeze(taken) });
      };
      return { api };
    },
  });
}
