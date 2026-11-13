import type { ResetOptions } from "../handle.js";
import type { Path } from "../path.js";
import type { Change } from "../store.js";
import type { FormContext } from "./context.js";

/** The store options the baseline reads. */
export interface BaselineOptions<V> {
  /** The starting value, which is also the first baseline. */
  readonly initial: V;
}

/** Dirty tracking, reset and the list of changes. */
export interface Baseline {
  /**
   * Computes `dirty` for the field at stable path `path` holding `value`.
   * The store core calls it as its `dirty` option, first when something
   * reads, never while the store is being made.
   */
  dirty(path: Path, value: unknown): boolean;
  /**
   * Puts the subtree at `path` back and clears its touched, edited and error
   * state. The form store calls it inside a batch, after validation has
   * stopped work in the subtree, and only for a live path.
   */
  reset(path: Path, options?: ResetOptions): void;
  /** Every dirty leaf at and below `path`, the whole form by default, in value order. */
  changes(path?: Path): readonly Change[];
}

/**
 * Makes the baseline. This is a placeholder: nothing is dirty, there are no
 * changes, and reset writes the initial value back.
 */
export function createBaseline<V, E, I, R>(context: FormContext<V, E, I, R>, _options: BaselineOptions<V>): Baseline {
  const { core } = context;
  return {
    dirty: () => false,
    reset(path) {
      core.batch(() => {
        core.set(path, core.getServerSnapshot(path).value);
        core.clearState(path, { validation: true });
      });
    },
    changes: () => [],
  };
}
