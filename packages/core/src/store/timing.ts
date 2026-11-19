import type { When, WriteRecord } from "../plugin.js";

// Core has no DOM types, so this declares the platform globals the buckets use.
declare const setTimeout: (fn: () => void) => unknown;
declare const scheduler: { postTask?(fn: () => void, options: { readonly priority: string }): unknown } | undefined;

/**
 * The `deferred` and `idle` timings of one plugin host. `definePlugin`
 * brings them, and the plugins that only use `sync` leave them out.
 */
export interface Timing<T> {
  /** Adds an observer with `onWrite` at `when`, which isn't `"sync"`. */
  add(when: Exclude<When, "sync">, observer: T): void;
  /** Adds a round's records to each timing that has observers, and schedules its delivery. */
  collect(round: readonly WriteRecord[]): void;
  /** Delivers waiting `deferred` and then `idle` records now. */
  flush(): void;
}

/** Records waiting for one timing's observers. */
interface Bucket<T> {
  /** The plugins with `onWrite` at this timing, in run order. */
  readonly observers: T[];
  records: WriteRecord[];
  /** True while a task to deliver them is scheduled. */
  due: boolean;
}

/** Makes a host's timings. `send` gives a list of records to the observers of one timing. */
export function createTiming<T>(send: (observers: readonly T[], records: readonly WriteRecord[]) => void): Timing<T> {
  const deferred: Bucket<T> = { observers: [], records: [], due: false };
  const idle: Bucket<T> = { observers: [], records: [], due: false };

  const drain = (bucket: Bucket<T>) => {
    bucket.due = false;
    const list = bucket.records;
    if (list.length === 0) return;
    bucket.records = [];
    send(bucket.observers, list);
  };

  const runDeferred = () => drain(deferred);
  const runIdle = () => drain(idle);

  const collect = (bucket: Bucket<T>, round: readonly WriteRecord[], schedule: () => void) => {
    if (bucket.observers.length === 0) return;
    for (const record of round) bucket.records.push(record);
    if (bucket.due) return;
    bucket.due = true;
    schedule();
  };

  return {
    add: (when, observer) => void (when === "deferred" ? deferred : idle).observers.push(observer),
    collect(round) {
      collect(deferred, round, () => void Promise.resolve().then(runDeferred));
      collect(idle, round, () => {
        if (typeof scheduler !== "undefined" && scheduler.postTask) scheduler.postTask(runIdle, { priority: "background" });
        else setTimeout(runIdle);
      });
    },
    flush() {
      runDeferred();
      runIdle();
    },
  };
}

/** Makes a host's timings, as `definePlugin` brings it. */
export type CreateTiming = typeof createTiming;
