import type { Path } from "../../path.js";
import type { WriteRecord } from "../../plugin.js";
import { freeze } from "../freeze.js";
import { type Entry, failure, type HostPart, maxRounds } from "../plugins.js";

/**
 * The part behind `onWrite`: every write leaves a record, and the end of
 * each batch hands them to the `sync` observers, before listeners run.
 * Writes the observers make go round again, up to `maxRounds`. A plugin with
 * a `deferred` or `idle` `onWrite` brings `timing` too.
 */
export const recorder: HostPart = (host) => {
  const { raw, core } = host;
  // The `sync` observers in run order. Records are made once there is any observer.
  const sync: Entry[] = [];
  let listening = false;
  let list: WriteRecord[] = [];

  const deliver = (observers: readonly Entry[], round: readonly WriteRecord[]) => {
    const frozen = freeze(round);
    for (const entry of observers) host.call(entry, () => entry.hooks.onWrite?.(frozen), undefined);
  };
  host.deliver = deliver;

  const valueAt = (path: Path) => raw.getSnapshot(path).value;
  const keysAt = (path: Path) => raw.getSnapshot(path).keys ?? [];
  const push = (record: WriteRecord) => {
    if (listening) list.push(freeze(record));
  };
  const flag =
    (type: "touched" | "disabled" | "readOnly", command: (path: Path, on: boolean) => boolean) => (path: Path, on: boolean) =>
      host.recorded(() => {
        if (!command(path, on)) return false;
        push({ type, path, before: !on, after: on, cause: host.cause });
        return true;
      });

  core.set = (path, input) =>
    host.recorded(() => {
      const before = valueAt(path);
      if (!host.raw.set(path, input)) return false;
      push({ type: "value", path, before, after: valueAt(path), cause: host.cause });
      return true;
    });
  core.insert = (path, index, input) =>
    host.recorded(() => {
      const before = valueAt(path);
      const key = host.raw.insert(path, index, input);
      if (key !== undefined) {
        // The item as written, after any `beforeWrite`.
        const after = valueAt(path);
        const at = keysAt(path).indexOf(key);
        const item: unknown = Array.isArray(after) ? after[at] : undefined;
        push({ type: "insert", path, before, after, index: at, key, item, cause: host.cause });
      }
      return key;
    });
  core.remove = (path, index) =>
    host.recorded(() => {
      const before = valueAt(path);
      const key = raw.remove(path, index);
      if (key !== undefined) {
        const item: unknown = Array.isArray(before) ? before[index] : undefined;
        push({ type: "remove", path, before, after: valueAt(path), index, key, item, cause: host.cause });
      }
      return key;
    });
  core.move = (path, from, to) =>
    host.recorded(() => {
      const before = valueAt(path);
      const key = keysAt(path)[from];
      if (!raw.move(path, from, to)) return false;
      const at = key === undefined ? to : keysAt(path).indexOf(key);
      push({ type: "move", path, before, after: valueAt(path), from, to: at, cause: host.cause });
      return true;
    });
  core.setTouched = flag("touched", (path, on) => raw.setTouched(path, on));
  core.setDisabled = flag("disabled", (path, on) => raw.setDisabled(path, on));
  core.setReadOnly = flag("readOnly", (path, on) => raw.setReadOnly(path, on));

  host.more = () => list.length > 0;
  host.stop = (rounds) => {
    if (rounds <= maxRounds) return false;
    const writers = new Set<string>();
    for (const record of list) if (typeof record.cause === "object") writers.add(record.cause.plugin);
    for (const [entry] of host.queue) writers.add(entry.plugin.name);
    const names = [...writers].join(", ");
    list = [];
    host.queue = [];
    host.report(failure("loop", names), names);
    return true;
  };
  host.round = () => {
    const round = list;
    list = [];
    if (round.length === 0) return;
    deliver(sync, round);
    host.collect?.(round);
  };

  // Observers are known once setup's writes have landed, so those writes leave no records.
  host.ready = () => {
    for (const entry of host.entries) {
      if (!entry.hooks.onWrite) continue;
      listening = true;
      if ((entry.hooks.when ?? "sync") === "sync") sync.push(entry);
      else host.observe?.(entry);
    }
  };
};
