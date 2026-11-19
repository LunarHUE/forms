import { describe, expect, it, vi } from "vitest";
import type { Path } from "../path.js";
import { createArrays } from "./arrays.js";
import { createStoreCore, type StoreCore } from "./core.js";
import { isContainer } from "./tree.js";

const make = (initial: unknown) => createStoreCore({ id: "f", initial, arrays: createArrays });

/** Counts listener calls per path. */
function count(store: StoreCore, paths: Path[]) {
  const runs = paths.map(() => 0);
  const stops = paths.map((path, i) => store.subscribe(path, () => void (runs[i] = (runs[i] ?? 0) + 1)));
  return { runs, stop: () => stops.forEach((stop) => stop()) };
}

const keysAt = (store: StoreCore, path: Path) => store.getSnapshot(path).keys;
const valueOf = (store: StoreCore, path: Path) => store.getSnapshot(path).value;

/** The value paths of the arrays and plain objects in `value` that aren't frozen. */
function unfrozen(value: unknown, path: Path = []): Path[] {
  if (!isContainer(value)) return [];
  const own = Object.isFrozen(value) ? [] : [path];
  const children = Array.isArray(value)
    ? value.map((item, i) => unfrozen(item, [...path, i]))
    : Object.keys(value).map((key) => unfrozen(Reflect.get(value, key), [...path, key]));
  return [...own, ...children.flat()];
}

/** Loads a fresh copy of the core under `stub`, writes to it, and reports what is frozen. */
async function frozenAfterWrites(stub: () => void) {
  vi.resetModules();
  stub();
  try {
    const fresh = await import("./core.js");
    const initial = { rows: [{ t: "a" }], meta: { n: 1 } };
    const store = fresh.createStoreCore({ id: "f", initial, arrays: (await import("./arrays.js")).createArrays });
    const written = { t: "b", tags: [] };
    store.insert(["rows"], 1, written);
    store.set(["rows", "k0", "t"], "z");
    store.set(["meta"], { n: 2 });
    const root = store.getSnapshot([]);
    return {
      root: Object.isFrozen(root),
      initial: Object.isFrozen(initial),
      written: Object.isFrozen(written),
      unfrozen: unfrozen(root.value),
    };
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  }
}

const nothingFrozen = {
  root: false,
  initial: false,
  written: false,
  unfrozen: [[], ["rows"], ["rows", 0], ["rows", 1], ["rows", 1, "tags"], ["meta"]],
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** `target[key] = value` on a value typed readonly or unknown. Module code is strict, so a frozen target throws. */
function assign(target: unknown, key: string, value: unknown): void {
  if (!isRecord(target)) throw new Error("not an object");
  target[key] = value;
}

/** `target.push(value)` on a value typed readonly or unknown. */
function push(target: unknown, value: unknown): void {
  if (!Array.isArray(target)) throw new Error("not an array");
  target.push(value);
}

describe("values", () => {
  it("reads the new value right after a write", () => {
    const store = make({ user: { name: "a", age: 1 } });
    expect(store.set(["user", "name"], "b")).toBe(true);
    expect(valueOf(store, ["user", "name"])).toBe("b");
    expect(valueOf(store, [])).toEqual({ user: { name: "b", age: 1 } });
  });

  it("shares untouched branches and leaves the initial value alone", () => {
    const initial = { a: { x: 1 }, b: { y: 2 } };
    const store = make(initial);
    store.set(["a", "x"], 5);
    expect(initial.a.x).toBe(1);
    expect(valueOf(store, ["b"])).toBe(initial.b);
  });

  it("changes nothing and wakes nobody for an equal value", () => {
    const store = make({ a: 1, n: Number.NaN });
    const before = store.getSnapshot([]);
    const { runs } = count(store, [[], ["a"], ["n"]]);
    expect(store.set(["a"], 1)).toBe(false);
    expect(store.set(["n"], Number.NaN)).toBe(false);
    expect(runs).toEqual([0, 0, 0]);
    expect(store.getSnapshot([])).toBe(before);
  });

  it("creates missing objects below a write", () => {
    const store = make({});
    store.set(["a", "b", "c"], 1);
    expect(valueOf(store, [])).toEqual({ a: { b: { c: 1 } } });
  });

  it("treats Date, Map, Set and class instances as leaves", () => {
    class Point {
      x = 1;
    }
    const value = { date: new Date(0), map: new Map([["k", 1]]), set: new Set([1]), point: new Point() };
    const store = make(value);
    expect(valueOf(store, ["date", "getTime"])).toBeUndefined();
    expect(valueOf(store, ["map", "k"])).toBeUndefined();
    expect(valueOf(store, ["point", "x"])).toBeUndefined();
    expect(store.set(["point", "x"], 2)).toBe(false);
    expect(value.point.x).toBe(1);
    expect(store.getSnapshot(["date"]).keys).toBeUndefined();
  });
});

describe("paths that name no field", () => {
  it("gives a stable undefined snapshot through a leaf and never throws", () => {
    const store = make({ title: "x" });
    const snapshot = store.getSnapshot(["title", "length", "deeper"]);
    expect(snapshot.value).toBeUndefined();
    expect(store.getSnapshot(["title", "length", "deeper"])).toBe(snapshot);
    const stop = store.subscribe(["title", "length"], () => undefined);
    stop();
    expect(store.set(["title", "length"], 1)).toBe(false);
    expect(valueOf(store, [])).toEqual({ title: "x" });
  });

  it("gives a stable undefined snapshot for an item key the array never had", () => {
    const store = make({ rows: [{ t: "a" }] });
    const unknown = store.getSnapshot(["rows", "nope", "t"]);
    expect(unknown.value).toBeUndefined();
    expect(store.getSnapshot(["rows", "nope", "t"])).toBe(unknown);
    // An index is not a key.
    expect(valueOf(store, ["rows", 0])).toBeUndefined();
    expect(store.set(["rows", "nope", "t"], "b")).toBe(false);
    expect(store.set(["rows", 0], "b")).toBe(false);
    expect(valueOf(store, [])).toEqual({ rows: [{ t: "a" }] });
  });

  it("reads missing fields under a missing object as undefined, and writes create them", () => {
    const store = make({});
    const missing = store.getSnapshot(["address", "city"]);
    expect(missing.value).toBeUndefined();
    expect(missing.name).toBe("address.city");
    store.set(["address", "city"], "Oslo");
    expect(valueOf(store, ["address", "city"])).toBe("Oslo");
  });
});

describe("item keys", () => {
  it("keys items positionally at creation, then by counter", () => {
    const store = make({ labels: [{ key: "a" }, { key: "b" }] });
    expect(keysAt(store, ["labels"])).toEqual(["k0", "k1"]);
    expect(store.insert(["labels"], 2, { key: "c" })).toBe("k2");
    expect(keysAt(store, ["labels"])).toEqual(["k0", "k1", "k2"]);
    store.remove(["labels"], 2);
    store.insert(["labels"], 99, { key: "d" });
    expect(keysAt(store, ["labels"])).toEqual(["k0", "k1", "k3"]);
  });

  it("keeps keys and values with their items through remove, insert and move", () => {
    const store = make({ labels: [{ key: "a" }, { key: "b" }, { key: "c" }] });
    store.set(["labels", "k2", "key"], "C");
    expect(store.remove(["labels"], 0)).toBe("k0");
    store.insert(["labels"], 0, { key: "z" });
    expect(store.move(["labels"], 2, 0)).toBe(true);
    expect(keysAt(store, ["labels"])).toEqual(["k2", "k3", "k1"]);
    expect(valueOf(store, ["labels"])).toEqual([{ key: "C" }, { key: "z" }, { key: "b" }]);
    const moved = store.getSnapshot(["labels", "k2", "key"]);
    expect(moved.value).toBe("C");
    expect(moved.name).toBe("labels.0.key");
  });

  it("re-keys by position when the array is replaced", () => {
    const store = make({ labels: [{ key: "a" }, { key: "b" }] });
    keysAt(store, ["labels"]);
    store.set(["labels"], [{ key: "only" }]);
    expect(keysAt(store, ["labels"])).toEqual(["k0"]);
    store.set(["labels"], [{ key: "only" }, { key: "two" }]);
    expect(keysAt(store, ["labels"])).toEqual(["k0", "k2"]);
  });

  it("re-keys the same way when an ancestor is replaced", () => {
    const store = make({ form: { labels: [{ key: "a" }, { key: "b" }] } });
    const second = store.getSnapshot(["form", "labels", "k1"]);
    store.set([], { form: { labels: [{ key: "x" }] } });
    expect(keysAt(store, ["form", "labels"])).toEqual(["k0"]);
    expect(valueOf(store, ["form", "labels", "k0", "key"])).toBe("x");
    expect(store.getSnapshot(["form", "labels", "k1"])).toBe(second);
  });

  it("drops every key when the array goes missing and makes fresh ones when it returns", () => {
    const store = make({ labels: ["a", "b"] });
    keysAt(store, ["labels"]);
    store.set(["labels"], undefined);
    expect(keysAt(store, ["labels"])).toEqual([]);
    store.set(["labels"], ["c"]);
    expect(keysAt(store, ["labels"])).toEqual(["k2"]);
  });

  it("gives two stores made from the same value the same keys", () => {
    expect(keysAt(make({ labels: [1, 2, 3] }), ["labels"])).toEqual(keysAt(make({ labels: [1, 2, 3] }), ["labels"]));
  });

  it("keeps a nested array's keys with its item when the item moves", () => {
    const store = make({ rows: [{ tags: ["a"] }, { tags: ["b", "c"] }] });
    store.insert(["rows", "k1", "tags"], 0, "z");
    expect(keysAt(store, ["rows", "k1", "tags"])).toEqual(["k2", "k0", "k1"]);
    store.move(["rows"], 1, 0);
    expect(keysAt(store, ["rows", "k1", "tags"])).toEqual(["k2", "k0", "k1"]);
    expect(store.getSnapshot(["rows", "k1", "tags", "k2"]).name).toBe("rows.0.tags.0");
  });

  it("inserts into a missing array and ignores array writes on other values", () => {
    const store = make({ text: "x" });
    expect(store.insert(["rows"], 0, "a")).toBe("k0");
    expect(valueOf(store, ["rows"])).toEqual(["a"]);
    expect(store.insert(["text"], 0, "a")).toBeUndefined();
    expect(store.insert([], 0, "a")).toBeUndefined();
    expect(store.remove(["rows"], 5)).toBeUndefined();
    expect(store.move(["rows"], 0, 0)).toBe(false);
    expect(store.move(["rows"], 3, 0)).toBe(false);
  });
});

describe("snapshot contents", () => {
  it("has the value, the dotted name, item keys and empty field state", () => {
    const store = make({ rows: [{ title: "a" }] });
    expect(store.getSnapshot([])).toMatchObject({ name: "", value: { rows: [{ title: "a" }] } });
    expect(store.getSnapshot(["rows"])).toMatchObject({ name: "rows", keys: ["k0"] });
    expect(store.getSnapshot(["rows", "k0", "title"])).toEqual({
      value: "a",
      name: "rows.0.title",
      errors: [],
      shownErrors: [],
      invalid: false,
      touched: false,
      edited: false,
      dirty: false,
      validating: false,
      disabled: false,
      readOnly: false,
    });
  });
});

describe("snapshot identity", () => {
  it("returns the identical object until the field changes", () => {
    const store = make({ a: 1 });
    const first = store.getSnapshot(["a"]);
    expect(store.getSnapshot(["a"])).toBe(first);
    store.set(["a"], 2);
    const second = store.getSnapshot(["a"]);
    expect(second).not.toBe(first);
    expect(store.getSnapshot(["a"])).toBe(second);
  });

  it("keeps a sibling's snapshot and replaces every ancestor's", () => {
    const store = make({ form: { a: { x: 1 }, b: { y: 2 } } });
    const read = () => ({
      root: store.getSnapshot([]),
      form: store.getSnapshot(["form"]),
      a: store.getSnapshot(["form", "a"]),
      x: store.getSnapshot(["form", "a", "x"]),
      b: store.getSnapshot(["form", "b"]),
      y: store.getSnapshot(["form", "b", "y"]),
    });
    const before = read();
    store.set(["form", "a", "x"], 5);
    const after = read();
    expect(after.root).not.toBe(before.root);
    expect(after.form).not.toBe(before.form);
    expect(after.a).not.toBe(before.a);
    expect(after.x).not.toBe(before.x);
    expect(after.b).toBe(before.b);
    expect(after.y).toBe(before.y);
    expect(after.form.value).not.toBe(before.form.value);
  });

  it("keeps a snapshot when a write changes the field's reach but none of its members", () => {
    const store = make({ a: undefined });
    const below = store.getSnapshot(["a", "b"]);
    store.set(["a"], "text");
    expect(store.getSnapshot(["a", "b"])).toBe(below);
    expect(store.set(["a", "b"], 1)).toBe(false);
  });

  it("replaces only the descendants whose value changed", () => {
    const store = make({ a: { same: { deep: 1 }, other: 1 } });
    const same = store.getSnapshot(["a", "same"]);
    const deep = store.getSnapshot(["a", "same", "deep"]);
    const other = store.getSnapshot(["a", "other"]);
    store.set(["a"], { same: valueOf(store, ["a", "same"]), other: 2 });
    expect(store.getSnapshot(["a", "same"])).toBe(same);
    expect(store.getSnapshot(["a", "same", "deep"])).toBe(deep);
    expect(store.getSnapshot(["a", "other"])).not.toBe(other);
  });

  it("gives an item a new snapshot when an insert before it changes its name", () => {
    const store = make({ rows: [{ t: "a" }, { t: "b" }] });
    const item = store.getSnapshot(["rows", "k1"]);
    const leaf = store.getSnapshot(["rows", "k1", "t"]);
    const first = store.getSnapshot(["rows", "k0"]);
    store.insert(["rows"], 1, { t: "new" });
    expect(store.getSnapshot(["rows", "k0"])).toBe(first);
    const moved = store.getSnapshot(["rows", "k1"]);
    expect(moved).not.toBe(item);
    expect(moved.value).toBe(item.value);
    expect(moved.name).toBe("rows.2");
    expect(store.getSnapshot(["rows", "k1", "t"]).name).toBe("rows.2.t");
    expect(store.getSnapshot(["rows", "k1", "t"]).value).toBe(leaf.value);
    expect(keysAt(store, ["rows"])).toEqual(["k0", "k2", "k1"]);
  });
});

describe("removed items", () => {
  it("keep returning their last snapshot, below them too", () => {
    const store = make({ rows: [{ t: "a", tags: ["x"] }, { t: "b", tags: [] }] });
    const item = store.getSnapshot(["rows", "k0"]);
    store.set(["rows", "k0", "t"], "edited");
    const last = store.getSnapshot(["rows", "k0"]);
    const leaf = store.getSnapshot(["rows", "k0", "t"]);
    expect(last).not.toBe(item);
    store.remove(["rows"], 0);
    expect(store.getSnapshot(["rows", "k0"])).toBe(last);
    expect(store.getSnapshot(["rows", "k0", "t"])).toBe(leaf);
    expect(leaf).toMatchObject({ value: "edited", name: "rows.0.t" });
    // A path never read before the removal reads from the item's last value.
    const tag = store.getSnapshot(["rows", "k0", "tags", "k0"]);
    expect(tag).toMatchObject({ value: "x", name: "rows.0.tags.0" });
    expect(store.getSnapshot(["rows", "k0", "tags", "k0"])).toBe(tag);
    // The survivor moved up.
    expect(store.getSnapshot(["rows", "k1"]).name).toBe("rows.0");
  });

  it("ignore writes, and stay dead when the array changes again", () => {
    const store = make({ rows: [{ t: "a" }, { t: "b" }] });
    const last = store.getSnapshot(["rows", "k0", "t"]);
    const { runs } = count(store, [["rows", "k0", "t"]]);
    store.remove(["rows"], 0);
    expect(runs).toEqual([0]);
    const value = store.getSnapshot([]).value;
    expect(store.set(["rows", "k0", "t"], "x")).toBe(false);
    expect(store.set(["rows", "k0"], { t: "x" })).toBe(false);
    expect(store.insert(["rows", "k0", "list"], 0, 1)).toBeUndefined();
    expect(store.getSnapshot([]).value).toBe(value);
    store.set(["rows"], [{ t: "c" }, { t: "d" }, { t: "e" }]);
    expect(store.getSnapshot(["rows", "k0", "t"])).toBe(last);
    expect(runs).toEqual([0]);
  });
});

describe("listener order", () => {
  it("wakes only subscriptions whose snapshot changed", () => {
    const store = make({ a: 1, b: { c: 2 } });
    const { runs } = count(store, [["a"], ["b", "c"], ["b"], []]);
    store.set(["a"], 3);
    expect(runs).toEqual([1, 0, 0, 1]);
    store.set(["b", "c"], 4);
    expect(runs).toEqual([1, 1, 1, 2]);
  });

  it("runs listeners before the write returns, with every snapshot already new", () => {
    const store = make({ a: 1, b: 1 });
    const fromA: unknown[] = [];
    const fromRoot: unknown[] = [];
    store.subscribe(["a"], () => {
      fromA.push(store.getSnapshot(["a"]).value, store.getSnapshot([]).value);
    });
    store.subscribe([], () => {
      fromRoot.push(store.getSnapshot(["a"]).value);
    });
    store.set(["a"], 2);
    expect(fromA).toEqual([2, { a: 2, b: 1 }]);
    expect(fromRoot).toEqual([2]);
  });
});

describe("listener counts", () => {
  it("wakes each subscription once per write", () => {
    const store = make({ rows: [{ t: "a" }, { t: "b" }] });
    const { runs } = count(store, [[], ["rows"], ["rows", "k0"], ["rows", "k1", "t"]]);
    store.set([], { rows: [{ t: "x" }, { t: "y" }] });
    expect(runs).toEqual([1, 1, 1, 1]);
    store.move(["rows"], 0, 1);
    expect(runs).toEqual([2, 2, 2, 2]);
  });

  it("wakes each subscription once per batch, after the outermost batch", () => {
    const store = make({ a: 1, b: 1 });
    const { runs } = count(store, [["a"], ["b"], []]);
    const result = store.batch(() => {
      store.set(["a"], 2);
      store.batch(() => {
        store.set(["a"], 3);
        store.set(["b"], 2);
      });
      expect(runs).toEqual([0, 0, 0]);
      expect(store.getSnapshot(["a"]).value).toBe(3);
      return "done";
    });
    expect(result).toBe("done");
    expect(runs).toEqual([1, 1, 1]);
  });

  it("doesn't wake a subscription whose field ends a batch as it started", () => {
    const store = make({ a: "x", b: 1 });
    const before = store.getSnapshot(["a"]);
    const { runs } = count(store, [["a"], ["b"]]);
    store.batch(() => {
      store.set(["a"], "y");
      store.set(["b"], 2);
      store.set(["a"], "x");
    });
    expect(runs).toEqual([0, 1]);
    expect(store.getSnapshot(["a"])).toBe(before);
  });

  it("runs listeners when a batch throws", () => {
    const store = make({ a: 1 });
    const { runs } = count(store, [["a"]]);
    expect(() =>
      store.batch(() => {
        store.set(["a"], 2);
        throw new Error("stop");
      }),
    ).toThrow("stop");
    expect(runs).toEqual([1]);
  });

  it("wakes only one row's subscription for a keystroke among many rows", () => {
    const rows = Array.from({ length: 2000 }, (_, i) => ({ title: `t${i}` }));
    const store = make({ rows });
    const keys = keysAt(store, ["rows"]) ?? [];
    const runs = new Map<string, number>();
    for (const key of keys) store.subscribe(["rows", key], () => runs.set(key, (runs.get(key) ?? 0) + 1));
    const others = keys.map((key) => store.getSnapshot(["rows", key]));
    store.set(["rows", "k500", "title"], "typed");
    expect([...runs]).toEqual([["k500", 1]]);
    const replaced = keys.filter((key, i) => store.getSnapshot(["rows", key]) !== others[i]);
    expect(replaced).toEqual(["k500"]);
  });
});

describe("listener safety", () => {
  it("lets a listener unsubscribe another before it runs", () => {
    const store = make({ a: 1 });
    const second = vi.fn<() => void>();
    let stopSecond: (() => void) | undefined;
    store.subscribe(["a"], () => stopSecond?.());
    stopSecond = store.subscribe(["a"], second);
    store.set(["a"], 2);
    expect(second).not.toHaveBeenCalled();
  });

  it("lets a listener unsubscribe itself and subscribe a new one, which waits for the next write", () => {
    const store = make({ a: 1 });
    const later = vi.fn<() => void>();
    const first = vi.fn<() => void>(() => {
      stop();
      store.subscribe(["a"], later);
    });
    const stop = store.subscribe(["a"], first);
    store.set(["a"], 2);
    expect(first).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();
    store.set(["a"], 3);
    expect(first).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it("lets a listener write, and wakes the others once with the latest snapshot", () => {
    const store = make({ a: 1 });
    const seen: unknown[] = [];
    // The root's listener runs first, since ancestors are queued before descendants.
    store.subscribe([], () => {
      if (store.getSnapshot(["a"]).value === 2) store.set(["a"], 3);
    });
    store.subscribe(["a"], () => seen.push(store.getSnapshot(["a"]).value));
    store.set(["a"], 2);
    expect(seen).toEqual([3]);
  });

  it("runs every listener when one throws, then rethrows the first error", () => {
    const store = make({ a: 1 });
    const after = vi.fn<() => void>();
    store.subscribe(["a"], () => {
      throw new Error("first");
    });
    store.subscribe(["a"], () => {
      throw new Error("second");
    });
    store.subscribe(["a"], after);
    expect(() => store.set(["a"], 2)).toThrow("first");
    expect(after).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot(["a"]).value).toBe(2);
  });
});

describe("side effects", () => {
  it("makes no nodes, keys or listeners until something reads", () => {
    const initial = { rows: [{ t: "a" }, { t: "b" }] };
    const store = make(initial);
    expect(store.stats()).toEqual({ nodes: 0, subscribed: 0 });
    expect(Object.isFrozen(initial)).toBe(false);
    // Had keys been made at creation, the first replacement would have dropped k1.
    const other = make({ rows: [{ t: "a" }, { t: "b" }] });
    other.set([], { rows: [{ t: "c" }] });
    other.set([], { rows: [{ t: "c" }, { t: "d" }] });
    expect(keysAt(other, ["rows"])).toEqual(["k0", "k1"]);
  });

  it("drops subscriber state with the last subscriber and works again after", () => {
    const store = make({ a: 1, b: 1 });
    const first = count(store, [["a"], ["b"], ["a"]]);
    expect(store.stats().subscribed).toBe(2);
    first.stop();
    first.stop();
    expect(store.stats().subscribed).toBe(0);
    store.set(["a"], 2);
    expect(first.runs).toEqual([0, 0, 0]);
    const again = count(store, [["a"]]);
    store.set(["a"], 3);
    expect(again.runs).toEqual([1]);
  });
});

describe("immutability", () => {
  it("freezes snapshots, keys and values, and rejects mutation", () => {
    const store = make({ rows: [{ t: "a", when: new Date(0) }] });
    const rows = store.getSnapshot(["rows"]);
    const root = store.getSnapshot([]);
    expect(() => assign(rows, "name", "x")).toThrow(TypeError);
    expect(() => push(rows.keys, "x")).toThrow(TypeError);
    expect(() => assign(valueOf(store, ["rows", "k0"]), "t", "x")).toThrow(TypeError);
    expect(() => push(valueOf(store, ["rows"]), 1)).toThrow(TypeError);
    expect(() => push(store.getSnapshot(["rows", "k0"]).errors, 1)).toThrow(TypeError);
    expect(Object.isFrozen(root)).toBe(true);
    // Leaves stay as they are.
    expect(Object.isFrozen(valueOf(store, ["rows", "k0", "when"]))).toBe(false);
  });

  it("freezes written values and only the new nodes", () => {
    const store = make({ a: { x: 1 }, b: { y: 1 } });
    const written = { z: [1] };
    const shared = store.getSnapshot(["b"]).value;
    store.set(["a"], written);
    expect(Object.isFrozen(written)).toBe(true);
    expect(Object.isFrozen(written.z)).toBe(true);
    expect(Object.isFrozen(store.getSnapshot([]).value)).toBe(true);
    expect(store.getSnapshot(["b"]).value).toBe(shared);
  });
});

describe("immutability through writes", () => {
  it("keeps every container frozen after each kind of write, and leaves leaves alone", () => {
    const when = new Date(0);
    const store = make({ rows: [{ t: "a", tags: ["x"] }, { t: "b", tags: [] }], meta: { n: 1 } });
    const writes: (() => unknown)[] = [
      () => store.set(["rows", "k0", "t"], "z"),
      () => store.set(["rows", "k1"], { t: "c", tags: [{ deep: [1] }], when }),
      () => store.insert(["rows"], 1, { t: "d", tags: [[2]] }),
      () => store.remove(["rows"], 0),
      () => store.move(["rows"], 0, 1),
      () => store.set(["meta", "extra"], { list: [{}] }),
      () => store.set(["fresh", "deep"], { x: [] }),
      () => store.set([], { rows: [{ t: "e", tags: [{}] }], meta: {} }),
      () => store.insert(["rows"], 0, { t: "f", tags: [] }),
    ];
    for (const write of writes) {
      write();
      expect(unfrozen(valueOf(store, []))).toEqual([]);
    }
    expect(Object.isFrozen(when)).toBe(false);
  });

  it("freezes nothing in production", async () => {
    expect(await frozenAfterWrites(() => vi.stubEnv("NODE_ENV", "production"))).toEqual(nothingFrozen);
  });

  it("freezes nothing and doesn't throw where process doesn't exist", async () => {
    expect(await frozenAfterWrites(() => vi.stubGlobal("process", undefined))).toEqual(nothingFrozen);
  });
});

describe("server snapshot", () => {
  it("is the snapshot from creation, whatever was written since", () => {
    const store = make({ rows: [{ t: "a" }, { t: "b" }] });
    const early = store.getSnapshot(["rows", "k1", "t"]);
    store.set(["rows", "k1", "t"], "x");
    store.insert(["rows"], 0, { t: "new" });
    const server = store.getServerSnapshot(["rows", "k1", "t"]);
    expect(server).toBe(early);
    expect(store.getServerSnapshot(["rows", "k1", "t"])).toBe(server);
    // Read for the first time after writes, it comes from the initial value.
    const list = store.getServerSnapshot(["rows"]);
    expect(list).toMatchObject({ name: "rows", keys: ["k0", "k1"], value: [{ t: "a" }, { t: "b" }] });
    expect(store.getServerSnapshot(["rows"])).toBe(list);
    expect(store.getServerSnapshot(["rows", "k0", "t"])).toMatchObject({ value: "a", name: "rows.0.t" });
    expect(store.getServerSnapshot(["rows", "k2"]).value).toBeUndefined();
  });

  it("equals the current snapshot before any write", () => {
    const store = make({ a: 1 });
    expect(store.getServerSnapshot(["a"])).toBe(store.getSnapshot(["a"]));
  });
});

// Flags the parent the way plugin setup does, then writes elsewhere, so
// the child below is made after the first change.
function flaggedAtStart(kind: "setDisabled" | "setReadOnly", parent: Path, initial: unknown) {
  const store = make(initial);
  store[kind](parent, true);
  store.started();
  store.set(["other"], "typed");
  return store;
}

describe("server flags of a field first read after a write", () => {
  it("is disabled under a parent disabled at start", () => {
    const store = flaggedAtStart("setDisabled", ["shipping"], { other: "", shipping: { street: "" } });
    expect(store.getServerSnapshot(["shipping", "street"])).toMatchObject({ value: "", disabled: true, readOnly: false });
  });

  it("is read-only under a parent locked at start", () => {
    const store = flaggedAtStart("setReadOnly", ["shipping"], { other: "", shipping: { street: "" } });
    expect(store.getServerSnapshot(["shipping", "street"])).toMatchObject({ disabled: false, readOnly: true });
  });

  it("is disabled two levels down", () => {
    const store = flaggedAtStart("setDisabled", ["shipping"], { other: "", shipping: { address: { street: "" } } });
    expect(store.getServerSnapshot(["shipping", "address", "street"]).disabled).toBe(true);
    expect(store.getServerSnapshot(["shipping", "address"]).disabled).toBe(true);
  });

  it("is disabled for an item under an array disabled at start", () => {
    const store = flaggedAtStart("setDisabled", ["rows"], { other: "", rows: [{ t: "a" }] });
    expect(store.getServerSnapshot(["rows", "k0", "t"])).toMatchObject({ value: "a", disabled: true });
    expect(store.getServerSnapshot(["rows", "k0"]).disabled).toBe(true);
  });

  it("stays disabled when the parent is enabled before the child is read", () => {
    const store = flaggedAtStart("setDisabled", ["shipping"], { other: "", shipping: { street: "" } });
    store.setDisabled(["shipping"], false);
    expect(store.getSnapshot(["shipping", "street"]).disabled).toBe(false);
    expect(store.getServerSnapshot(["shipping", "street"]).disabled).toBe(true);
  });

  it("follows the definition when nothing changed before the start", () => {
    const store = make({ other: "", shipping: { street: "" } });
    store.getSnapshot(["shipping"]);
    store.started();
    store.set(["other"], "typed");
    store.setDisabled(["shipping"], true);
    expect(store.getServerSnapshot(["shipping", "street"]).disabled).toBe(false);
  });

  it("takes the value written before the start, clean with no dirty option", () => {
    const store = make({ other: "", shipping: { street: "" } });
    store.set(["shipping"], { street: "1 Main St" });
    store.started();
    store.set(["other"], "typed");
    expect(store.getServerSnapshot(["shipping", "street"]).value).toBe("1 Main St");
    // With no `dirty` option nothing is dirty.
    expect(store.getServerSnapshot(["shipping", "street"]).dirty).toBe(false);
  });

  it("asks the dirty option about the value the field started with", () => {
    const dirty = vi.fn<(path: Path, value: unknown) => boolean>((_path, value) => value !== "");
    const store = createStoreCore({ id: "f", initial: { other: "", shipping: { street: "", city: "" } }, dirty, arrays: createArrays });
    store.set(["shipping"], { street: "1 Main St", city: "" });
    store.started();
    store.set(["other"], "typed");
    expect(store.getServerSnapshot(["shipping", "street"]).dirty).toBe(true);
    expect(store.getServerSnapshot(["shipping", "city"]).dirty).toBe(false);
    expect(dirty).toHaveBeenCalledWith(["shipping", "street"], "1 Main St");
  });
});

const bare = (initial: unknown) => createStoreCore({ id: "f", initial });

describe("without arrays()", () => {
  it("keys every array by position, the same on the server, with the same list while the length holds", () => {
    const store = bare({ rows: [{ t: "a" }, { t: "b" }] });
    const keys = keysAt(store, ["rows"]);
    expect(keys).toEqual(["k0", "k1"]);
    expect(store.getServerSnapshot(["rows"]).keys).toEqual(keys);
    store.set(["rows", "k1", "t"], "z");
    expect(keysAt(store, ["rows"])).toBe(keys);
    expect(store.pathOf("rows.1.t")).toEqual(["rows", "k1", "t"]);
    expect(store.itemSteps(["rows", "k1", "t"])).toEqual([false, true, false]);
  });

  it("throws on an array command", () => {
    const store = bare({ rows: [] });
    expect(() => store.insert(["rows"], 0, "a")).toThrow("arrays()");
    expect(() => store.remove(["rows"], 0)).toThrow("arrays()");
    expect(() => store.move(["rows"], 0, 1)).toThrow("arrays()");
  });

  it("blocks an item past the end after a shorter array is written, and lets it back when the array grows", () => {
    // With arrays() the item is removed for good and the new third item gets a fresh key.
    const store = bare({ rows: ["a", "b", "c"] });
    expect(store.getSnapshot(["rows", "k2"]).value).toBe("c");
    store.set(["rows"], ["a", "b"]);
    expect(store.isLive(["rows", "k2"])).toBe(false);
    store.set(["rows"], ["a", "b", "d"]);
    expect(store.getSnapshot(["rows", "k2"]).value).toBe("d");
    expect(keysAt(store, ["rows"])).toEqual(["k0", "k1", "k2"]);
  });
});
