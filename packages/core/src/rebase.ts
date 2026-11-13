import type { HandleBase, ValueOf } from "./handle.js";
import type { Path } from "./path.js";

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
export type Rebase = <H extends HandleBase<unknown, unknown>>(
  handle: H,
  incoming: ValueOf<H>,
  resolve: Resolve,
) => RebaseResult;
