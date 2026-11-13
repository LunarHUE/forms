import type { Equals } from "../definition.js";
import type { Path } from "../path.js";
import type { Change } from "../store.js";
import { createEquality, ownKeys } from "./baseline/equality.js";
import { childKeys, keysOf, type KeyTrie } from "./baseline/keys.js";
import type { StoreCore } from "./core.js";
import { none, sameList } from "./entries.js";
import { freeze } from "./freeze.js";
import { childOf, isPlainObject } from "./tree.js";

/** The store options dirty tracking reads. */
export interface DirtyOptions {
  /** The form's dirty comparison. It runs first and reaches `sharedEquals` through `next`. */
  readonly equals?: Equals | undefined;
  /** The comparison every form of one `createFormsCore` shares. It reaches the default through `next`. */
  readonly sharedEquals?: Equals | undefined;
}

/** The baseline value at one stable path and the item keys of its arrays. */
export type FindBaseline = (path: Path) => { value: unknown; keys: KeyTrie | undefined };

/** What the baseline asks of dirty tracking. Without `dirty()` nothing is dirty. */
export interface Dirty {
  /** Computes `dirty` for the field at stable path `path` holding `value`. */
  dirty(this: void, path: Path, value: unknown): boolean;
  /** Every dirty leaf at and below `path`. See `Baseline.changes`. */
  changes(this: void, path?: Path): readonly Change[];
  /** True when `a` equals `b` at `path` by the form's comparison, with the baseline's item keys there. */
  equals(this: void, path: Path, a: unknown, b: unknown): boolean;
  /** Forgets cached results. The baseline calls it when its key trie changes. */
  forget(this: void): void;
}

/** Makes dirty tracking for one store. `dirty()` brings it. Internal. */
export type CreateDirty = (core: StoreCore<unknown, unknown>, find: FindBaseline, options: DirtyOptions) => Dirty;

/**
 * Dirty tracking: the comparison, with the form's `equals` and the shared
 * one, and the list of changes. The baseline value stays in core, since
 * reset, `rebase` and `bind` need it without this.
 */
export const createDirty: CreateDirty = (core, find, options) => {
  const { compare, forget } = createEquality(options.equals, options.sharedEquals);
  return {
    dirty(path, value) {
      const { value: baseline, keys } = find(path);
      return !compare(path, value, baseline, keys);
    },
    changes(path) {
      const start = (path ?? []).map(String);
      if (!core.isLive(start)) return none;
      const out: Change[] = [];
      const walk = (at: Path, value: unknown, baseline: unknown, keys: KeyTrie | undefined) => {
        if (compare(at, value, baseline, keys)) return;
        const before = out.length;
        if (isPlainObject(value) && isPlainObject(baseline)) {
          for (const key of ownKeys(value, baseline))
            walk([...at, key], childOf(value, key), childOf(baseline, key), childKeys(keys, key));
        } else if (Array.isArray(value) && Array.isArray(baseline) && value.length === baseline.length) {
          const current = core.getSnapshot(at).keys ?? none;
          if (sameList(current, keysOf(keys, baseline.length)))
            current.forEach((key, i) => walk([...at, key], value[i], baseline[i], childKeys(keys, key)));
        }
        // A container whose children all compare equal still differs as a whole.
        if (out.length === before) out.push(freeze({ path: freeze(at), baseline, value }));
      };
      const { value: baseline, keys } = find(start);
      walk(start, core.getSnapshot(start).value, baseline, keys);
      return freeze(out);
    },
    equals: (path, a, b) => compare(path, a, b, find(path).keys),
    forget,
  };
};
