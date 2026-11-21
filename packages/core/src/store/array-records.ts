import type { WriteCause, WriteRecord } from "../plugin.js";
import type { Path } from "../path.js";
import type { StoreCore } from "./core.js";
import { refuse } from "./refuse.js";

/** What the plugin host lends the array commands. */
export interface ArrayHost {
  readonly raw: StoreCore<unknown, unknown>;
  /** Runs `fn` in a batch of the host's. Throws inside a hook. */
  recorded<T>(this: void, fn: () => T): T;
  /** Keeps `record` for the observers when some listen. */
  push(this: void, record: WriteRecord): void;
  /** Runs a write at `path` through `beforeWrite`. Returns the value to write, or `refuse`. */
  transform(this: void, path: Path, input: unknown, was: unknown): unknown;
  /** The cause of the write running now. */
  cause(this: void): WriteCause;
}

/** The array commands of a store with plugins, which `beforeWrite` sees and which leave records. */
export type ArrayCommands = Pick<StoreCore<unknown, unknown>, "insert" | "remove" | "move">;

/** Wraps the array commands for the plugin host. `arrays()` brings it, so a form without arrays doesn't. */
export const recordArrays = ({ raw, recorded, push, transform, cause }: ArrayHost): ArrayCommands => {
  const valueOf = (path: Path) => raw.getSnapshot(path).value;
  const keysAt = (path: Path) => raw.getSnapshot(path).keys ?? [];
  return {
    // The row's key exists only once it is in, so `beforeWrite` sees the row
    // after the insert, as a write at the row's path. A refused row comes out again.
    insert: (path, index, input) =>
      recorded(() => {
        const before = valueOf(path);
        let key = raw.insert(path, index, input);
        let item = input;
        if (key !== undefined) {
          const row = [...path, key];
          item = transform(row, input, undefined);
          if (item === refuse) {
            raw.remove(path, keysAt(path).indexOf(key));
            key = undefined;
          } else if (!Object.is(item, input)) raw.set(row, item);
        }
        if (key !== undefined)
          push({ type: "insert", path, before, after: valueOf(path), index: keysAt(path).indexOf(key), key, item, cause: cause() });
        return key;
      }),
    remove: (path, index) =>
      recorded(() => {
        const before = valueOf(path);
        const key = raw.remove(path, index);
        if (key !== undefined) {
          const item: unknown = Array.isArray(before) ? before[index] : undefined;
          push({ type: "remove", path, before, after: valueOf(path), index, key, item, cause: cause() });
        }
        return key;
      }),
    move: (path, from, to) =>
      recorded(() => {
        const before = valueOf(path);
        const key = keysAt(path)[from];
        if (!raw.move(path, from, to)) return false;
        const at = key === undefined ? to : keysAt(path).indexOf(key);
        push({ type: "move", path, before, after: valueOf(path), from, to: at, cause: cause() });
        return true;
      }),
  };
};
