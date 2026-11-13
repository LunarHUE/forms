import type { Equals } from "../definition.js";
import type { ResetOptions } from "../handle.js";
import type { Path, PathSegment } from "../path.js";
import type { Change } from "../store.js";
import { createEquality, ownKeys, type Compare } from "./baseline/equality.js";
import {
  buildKeys,
  childKeys,
  indexKeys,
  indexOfItem,
  keysOf,
  locate,
  type KeysFor,
  type KeyTrie,
} from "./baseline/keys.js";
import type { FormContext } from "./context.js";
import { none, sameList } from "./entries.js";
import { deepFreeze, freeze, freezePath } from "./freeze.js";
import { childOf, isPlainObject, setAt } from "./tree.js";

/** The store options the baseline reads. */
export interface BaselineOptions<V> {
  /** The starting value, which is also the first baseline. */
  readonly initial: V;
  /** The form's dirty comparison. It runs first and reaches `sharedEquals` through `next`. */
  readonly equals?: Equals | undefined;
  /** The comparison every form of one `createFormsCore` shares. It reaches the default through `next`. */
  readonly sharedEquals?: Equals | undefined;
}

/**
 * Dirty tracking, reset and the list of changes.
 *
 * The baseline is a value plus the item keys of its arrays. An array item's
 * baseline is the baseline item with the same key, so an item keeps its
 * baseline when it moves, and an inserted item has none (undefined). An
 * array is dirty when its value differs in order, so a move, insert or
 * remove makes the array dirty even when no item is.
 */
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
  /**
   * Every dirty leaf at and below `path`, the whole form by default, in value
   * order. Objects are walked key by key. An array is walked item by item
   * while its items have the keys and order of its baseline, and is one leaf
   * otherwise.
   */
  changes(this: void, path?: Path): readonly Change[];
  /** The baseline value at stable path `path`, and the item keys of the arrays in it. */
  locate(path: Path): { readonly value: unknown; readonly keys: KeyTrie | undefined };
  /** Compares two values with the form's equality chain. `keys` names the items of `b`. */
  readonly compare: Compare;
  /**
   * Makes `value` the baseline of the subtree at `path`, taking each array's
   * item keys from `keysFor`. A path through an item the baseline lacks adds
   * that item. It doesn't recheck dirty: call the core's `recheckDirty` after.
   */
  move(path: Path, value: unknown, keysFor: KeysFor): void;
  /** Reads each array's item keys from the store, for a subtree whose value was just written. */
  readonly currentKeys: KeysFor;
}

// A copy of `container` with `inner` at `key`. In development the copy is
// frozen as it is made, and so is `inner` when it is the written value.
// Everything else is shared with the frozen baseline.
const put = (container: unknown, key: PathSegment, inner: unknown): unknown => {
  const copy = setAt(container, [key], inner);
  return freezePath(copy, [key]);
};

const emptyTrie = (): KeyTrie => ({ list: undefined, children: undefined });

/** Makes the baseline. It starts as the initial value with positional item keys. */
export function createBaseline<V, E, I, R>(context: FormContext<V, E, I, R>, options: BaselineOptions<V>): Baseline {
  const { core } = context;
  const { initial } = options;
  const { compare, forget } = createEquality(options.equals, options.sharedEquals);
  let root: unknown = initial;
  let trie: KeyTrie | undefined;

  const find = (path: Path) => locate(root, trie, path);

  const currentKeys: KeysFor = (path, length) => {
    const snapshot = core.getSnapshot(path);
    return Array.isArray(snapshot.value) && snapshot.keys ? snapshot.keys : keysOf(undefined, length);
  };

  const move = (path: Path, value: unknown, keysFor: KeysFor) => {
    const p = path.map(String);
    const steps = core.itemSteps(p);
    if (!steps) return;
    forget();
    const built = buildKeys(p, value, keysFor);
    if (p.length === 0) {
      root = deepFreeze(value);
      trie = built;
      return;
    }
    // Nothing to add where the baseline is already missing.
    if (value === undefined && find(p).value === undefined) return;

    const child = (t: KeyTrie, seg: string): KeyTrie => {
      let next = t.children?.get(seg);
      if (!next) (t.children ??= new Map()).set(seg, (next = emptyTrie()));
      return next;
    };
    // A copy of `v` with `value` at `p` from step `i` on, sharing everything else.
    const place = (v: unknown, t: KeyTrie, i: number): unknown => {
      const seg = p[i] ?? "";
      const last = i === p.length - 1;
      const below = (held: unknown) => {
        if (!last) return place(held, child(t, seg), i + 1);
        if (built) (t.children ??= new Map()).set(seg, built);
        else t.children?.delete(seg);
        return value;
      };
      if (steps[i] === true) {
        let items: readonly unknown[] = Array.isArray(v) ? v : [];
        let index = indexOfItem(t, seg, items.length);
        if (index < 0) {
          // An item the baseline lacks goes where it sits now, as far as the baseline reaches.
          const now = core.getSnapshot(p.slice(0, i)).keys?.indexOf(seg) ?? -1;
          index = now < 0 ? items.length : Math.min(now, items.length);
          const keys = [...keysOf(t, items.length)];
          keys.splice(index, 0, seg);
          // Spread then splice, since `slice` is slow on the frozen arrays of development.
          const grown = [...items];
          grown.splice(index, 0, undefined);
          items = grown;
          t.list = indexKeys(keys);
        }
        return put(items, index, below(items[index]));
      }
      const object = isPlainObject(v) ? v : {};
      return put(object, seg, below(childOf(object, seg)));
    };
    // The shared branches must be frozen already. The initial value is frozen
    // here on the first move unless the core froze it first.
    deepFreeze(root);
    root = place(root, (trie ??= emptyTrie()), 0);
  };

  return {
    dirty(path, value) {
      const { value: baseline, keys } = find(path);
      return !compare(path, value, baseline, keys);
    },
    reset(path, resetOptions) {
      const p = path.map(String);
      core.batch(() => {
        const target = resetOptions?.to === "initial" ? locate(initial, undefined, p).value : find(p).value;
        core.set(p, target);
        core.clearState(p, { validation: true });
        // Writing kept the items' keys by index, so the baseline pairs with them from now on.
        move(p, target, currentKeys);
        core.recheckDirty();
      });
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
    locate: find,
    compare,
    move,
    currentKeys,
  };
}
