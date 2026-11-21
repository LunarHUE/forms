/** One listener on a cell. */
interface Subscription {
  readonly listener: () => void;
  /** The snapshot this listener last saw. It isn't called again until the snapshot differs. */
  seen: unknown;
  active: boolean;
}

/** Something listeners watch: a field, the form, or a counter. */
export interface Cell<S> {
  snapshot: S;
  /** The snapshot from before the first change since listeners last ran. Set only while the cell waits to wake them. */
  before: S | undefined;
  subscriptions: Set<Subscription> | undefined;
}

/**
 * The subscription code of one store, as a tuple so the names minify:
 * - `replace` gives a cell its new snapshot and queues its listeners. The
 *   caller settles the snapshot first, so an equal one keeps its identity.
 * - `listen` adds a listener to a cell and returns the function that removes it.
 * - `flush` runs the queued listeners, each once, unless a batch is open.
 *   It throws the first error a listener threw, after running the rest.
 * - `batch` runs `fn` and holds listeners until the outermost batch returns.
 */
export type Cells = readonly [
  replace: <S>(cell: Cell<S>, next: S) => void,
  listen: <S>(cell: Cell<S>, listener: () => void) => () => void,
  flush: () => void,
  batch: <T>(fn: () => T) => T,
];

/** Makes the subscription code of one store: listeners per cell, each woken once per change. */
export function createCells(): Cells {
  let depth = 0;
  // Cells whose snapshot changed and whose listeners haven't run yet.
  const pending = new Set<Cell<unknown>>();

  const flush = () => {
    if (depth > 0 || pending.size === 0) return;
    const cells = [...pending];
    pending.clear();
    let failed = false;
    let error: unknown;
    for (const cell of cells) {
      cell.before = undefined;
      if (!cell.subscriptions) continue;
      // A Set skips entries deleted during the loop. One added during the loop
      // has already seen the current snapshot, so the check below skips it.
      for (const subscription of cell.subscriptions) {
        if (!subscription.active || subscription.seen === cell.snapshot) continue;
        subscription.seen = cell.snapshot;
        try {
          subscription.listener();
        } catch (caught) {
          if (!failed) {
            failed = true;
            error = caught;
          }
        }
      }
    }
    if (failed) throw error;
  };

  return [
    (cell, next) => {
      const previous = cell.snapshot;
      if (next === previous) return;
      cell.snapshot = next;
      if (cell.subscriptions && !pending.has(cell)) {
        cell.before = previous;
        pending.add(cell);
      }
    },
    (cell, listener) => {
      const subscription: Subscription = { listener, seen: cell.snapshot, active: true };
      (cell.subscriptions ??= new Set()).add(subscription);
      return () => {
        if (!subscription.active) return;
        subscription.active = false;
        cell.subscriptions?.delete(subscription);
        // The set and the pending entry only serve subscribers, so they go with the last one.
        if (cell.subscriptions?.size === 0) {
          cell.subscriptions = undefined;
          cell.before = undefined;
          pending.delete(cell);
        }
      };
    },
    flush,
    (fn) => {
      depth++;
      try {
        return fn();
      } finally {
        depth--;
        flush();
      }
    },
  ];
}

/** How a store wakes its listeners. Pass `perField()` as `subscribe`. */
export type Subscribe = () => Cells;

/**
 * Wakes each field's listeners only when that field's snapshot changes,
 * once per change, with writes in a batch woken together. Pass it as
 * `createForms({ subscribe: perField() })`.
 *
 * In `/mini` the default is one subscription for the whole form: every
 * change wakes every listener, and each one compares its snapshot. That is
 * the smallest code, and fine for a few fields. `perField()` costs a few
 * hundred bytes and suits a form whose fields are many or slow to render.
 * The full entry always wakes per field and takes the option so a form
 * moves from `/mini` with one changed import.
 */
export const perField = (): Subscribe => createCells;
