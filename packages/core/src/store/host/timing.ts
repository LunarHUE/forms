import type { WriteRecord } from "../../plugin.js";
import type { Entry, HostPart } from "../plugins.js";

// Core has no DOM types, so this declares the platform globals it uses.
declare const setTimeout: (fn: () => void) => unknown;
declare const scheduler: { postTask?(fn: () => void, options: { readonly priority: string }): unknown } | undefined;

/** Records waiting for one timing's observers. */
interface Bucket {
  /** The plugins with `onWrite` at this timing, in run order. */
  readonly observers: Entry[];
  records: WriteRecord[];
  /** True while a task to deliver them is scheduled. */
  due: boolean;
}

/**
 * The part behind `when: "deferred"` and `when: "idle"`. It comes with
 * `recorder`, which hands it each round's records. Deferred observers get
 * them a microtask later, idle ones once the page is idle, and `flush`
 * delivers both now.
 */
export const timing: HostPart = (host) => {
  const deferred: Bucket = { observers: [], records: [], due: false };
  const idle: Bucket = { observers: [], records: [], due: false };

  // Delivers a bucket's records. Writes its observers queued run in a batch of their own.
  const empty = (bucket: Bucket) => {
    bucket.due = false;
    const list = bucket.records;
    if (list.length === 0) return;
    bucket.records = [];
    host.deliver?.(bucket.observers, list);
    host.drain();
  };

  const runDeferred = () => empty(deferred);
  const runIdle = () => empty(idle);

  // Adds a round's records to a bucket and schedules its delivery.
  const collect = (bucket: Bucket, round: readonly WriteRecord[], schedule: () => void) => {
    if (bucket.observers.length === 0) return;
    for (const record of round) bucket.records.push(record);
    if (bucket.due) return;
    bucket.due = true;
    schedule();
  };

  host.observe = (entry) => (entry.hooks.when === "deferred" ? deferred : idle).observers.push(entry);
  host.collect = (round) => {
    collect(deferred, round, () => void Promise.resolve().then(runDeferred));
    collect(idle, round, () => {
      if (typeof scheduler !== "undefined" && scheduler.postTask) scheduler.postTask(runIdle, { priority: "background" });
      else setTimeout(runIdle);
    });
  };
  host.flush = () => {
    runDeferred();
    runIdle();
  };
};
