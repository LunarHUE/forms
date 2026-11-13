import type { Path } from "../../path.js";
import { freeze } from "../freeze.js";
import { type HostPart, refuse } from "../plugins.js";

/**
 * The part behind `beforeWrite`: each value write, and each row an insert
 * adds, goes through the plugins' `beforeWrite` first. It wraps `set` and
 * `insert` of the value store under the host's, so `recorder` sees what
 * was written.
 */
export const transforms: HostPart = (host) => {
  const { raw } = host;
  const valueAt = (path: Path) => raw.getSnapshot(path).value;

  // Runs `input` through each `beforeWrite`, in run order. Returns the value to write, or `refuse`.
  const transform = (path: Path, input: unknown, before: unknown): unknown => {
    let value = input;
    for (const entry of host.entries) {
      if (!entry.hooks.beforeWrite) continue;
      const write = freeze({ path, input, value, before, cause: host.cause });
      value = host.call(entry, () => entry.hooks.beforeWrite?.(write), value);
      if (value === refuse) break;
    }
    return value;
  };

  host.raw = {
    ...raw,
    set(path, input) {
      const value = transform(path, input, valueAt(path));
      return value !== refuse && raw.set(path, value);
    },
    // The row's key exists only once it is in, so `beforeWrite` sees the row
    // after the insert, as a write at the row's path. A refused row comes out again.
    insert(path, index, input) {
      const key = raw.insert(path, index, input);
      if (key === undefined || !host.entries.some((entry) => entry.hooks.beforeWrite !== undefined)) return key;
      const row = [...path, key];
      const item = transform(row, input, undefined);
      if (item !== refuse) {
        raw.set(row, item);
        return key;
      }
      raw.remove(path, (raw.getSnapshot(path).keys ?? []).indexOf(key));
      return undefined;
    },
  };
};
