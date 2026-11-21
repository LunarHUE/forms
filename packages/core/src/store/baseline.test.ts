import { describe, expect, it, vi } from "vitest";
import type { Equals } from "../definition.js";
import type { FormError } from "../errors.js";
import type { Path } from "../path.js";
import { type Rebase, rebase as rebasePlugin } from "../plugins/rebase.js";
import { arrays } from "../plugins/arrays.js";
import { dirty as dirtyPlugin } from "../plugins/dirty.js";
import { createFormInternals, type FormStoreOptions, type MadeStore } from "./form-store.js";
import type { Handle } from "./handles.js";
import { isContainer } from "./tree.js";

type Store = MadeStore<unknown, FormError, undefined, unknown>;
type Options = Omit<FormStoreOptions<unknown>, "id" | "initial">;

const make = (initial: unknown, options: Options = {}) => {
  const parts = createFormInternals<unknown>({ id: "f", initial, plugins: [arrays(), rebasePlugin(), dirtyPlugin()], ...options });
  // The internals' store has no typed plugin APIs. The rebase plugin's API is a `Rebase`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const rebase = (parts.store.plugins as { readonly rebase: Rebase }).rebase;
  return { ...parts, root: parts.store.root, rebase };
};

const err = (message: string): FormError => ({ message });

/** Looks a handle up by stable path and fails the test when there is none. */
function field(store: Store, path: Path): Handle<FormError> {
  const handle = store.fieldAt(path);
  if (!handle) throw new Error(`no field at ${path.join(".")}`);
  return handle;
}

/** Counts listener calls per path. `"form"` counts form listener calls. */
function count(store: Store, paths: (Path | "form")[]) {
  const runs = paths.map(() => 0);
  for (const [i, path] of paths.entries()) {
    const listener = () => void (runs[i] = (runs[i] ?? 0) + 1);
    if (path === "form") store.subscribeForm(listener);
    else store.subscribe(path, listener);
  }
  return runs;
}

/** The value paths of the arrays and plain objects in `value` that aren't frozen. */
function unfrozen(value: unknown, path: Path = []): Path[] {
  if (!isContainer(value)) return [];
  const own = Object.isFrozen(value) ? [] : [path];
  const children = Array.isArray(value)
    ? value.map((item, i) => unfrozen(item, [...path, i]))
    : Object.keys(value).map((key) => unfrozen(Reflect.get(value, key), [...path, key]));
  return [...own, ...children.flat()];
}

const dirty = (store: Store, path: Path) => store.getSnapshot(path).dirty;

describe("dirty", () => {
  it("is clean at the start and after a change back", () => {
    const { store, root } = make({ name: "db", address: { city: "a", street: "b" } });
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(dirty(store, ["name"])).toBe(false);
    root.at("name").setValue("api");
    expect(dirty(store, ["name"])).toBe(true);
    expect(dirty(store, [])).toBe(true);
    expect(store.getFormSnapshot().dirty).toBe(true);
    root.at("name").setValue("db");
    expect(dirty(store, ["name"])).toBe(false);
    expect(dirty(store, [])).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(false);
  });

  it("marks a field and its ancestors, not its siblings", () => {
    const { store, root } = make({ address: { city: "a", street: "b" }, name: "n" });
    root.at("address").at("city").setValue("Oslo");
    expect(dirty(store, ["address"])).toBe(true);
    expect(dirty(store, ["address", "city"])).toBe(true);
    expect(dirty(store, ["address", "street"])).toBe(false);
    expect(dirty(store, ["name"])).toBe(false);
  });

  it("counts a missing key as undefined", () => {
    const { store, root } = make({ a: { x: 1 } });
    root.at("a").setValue({ x: 1, y: undefined }, { replace: true });
    expect(dirty(store, ["a"])).toBe(false);
    root.at("a").setValue({ y: null });
    expect(dirty(store, ["a"])).toBe(true);
  });

  it("compares dates by timestamp", () => {
    const { store, root } = make({ when: new Date(5) });
    root.at("when").setValue(new Date(5));
    expect(dirty(store, ["when"])).toBe(false);
    root.at("when").setValue(new Date(6));
    expect(dirty(store, ["when"])).toBe(true);
  });

  it("keeps the form snapshot when a write leaves the form's dirty as it was", () => {
    const { store, root } = make({ a: "x", b: "y" });
    root.at("a").setValue("1");
    const form = store.getFormSnapshot();
    const b = store.getSnapshot(["b"]);
    const runs = count(store, ["form", ["b"]]);
    root.at("a").setValue("2");
    expect(store.getFormSnapshot()).toBe(form);
    expect(store.getSnapshot(["b"])).toBe(b);
    expect(runs).toEqual([0, 0]);
    root.at("a").setValue("x");
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(runs).toEqual([1, 0]);
  });

  it("replaces an ancestor's snapshot only for its value when its dirty holds", () => {
    const { store, root } = make({ a: { x: 1, y: 1 } });
    root.at("a").at("x").setValue(2);
    const before = store.getSnapshot(["a"]);
    root.at("a").at("y").setValue(2);
    const after = store.getSnapshot(["a"]);
    expect(after).not.toBe(before);
    expect({ ...after, value: before.value }).toEqual(before);
  });

  it("asks the form's equals first, then the shared one, then the default", () => {
    const order: string[] = [];
    const equals: Equals = (a, b, ctx, next) => {
      order.push(`form:${ctx.path.join(".")}`);
      return ctx.path[0] === "ignored" ? true : next(a, b);
    };
    const sharedEquals: Equals = (a, b, ctx, next) => {
      order.push(`shared:${ctx.path.join(".")}`);
      return typeof a === "string" && typeof b === "string" ? a.trim() === b.trim() : next(a, b);
    };
    const { store, root } = make({ ignored: 1, name: "a" }, { equals, sharedEquals });
    store.getFormSnapshot();
    order.length = 0;
    root.at("name").setValue(" a ");
    expect(dirty(store, ["name"])).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(order.slice(0, 4)).toEqual(["form:", "shared:", "form:name", "shared:name"]);
    root.at("ignored").setValue(2);
    expect(dirty(store, ["ignored"])).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(false);
  });
});

const rows = () => ({ rows: [{ t: "a" }, { t: "b" }, { t: "c" }] });

describe("arrays", () => {
  it("keeps each item's baseline when items move, and makes the array dirty", () => {
    const { store, root } = make(rows());
    root.at("rows").move(0, 2);
    expect(store.getSnapshot(["rows"]).keys).toEqual(["k1", "k2", "k0"]);
    expect(dirty(store, ["rows"])).toBe(true);
    expect(dirty(store, ["rows", "k0"])).toBe(false);
    expect(dirty(store, ["rows", "k1"])).toBe(false);
    expect(store.changes()).toEqual([
      { path: ["rows"], baseline: rows().rows, value: [{ t: "b" }, { t: "c" }, { t: "a" }] },
    ]);
    root.at("rows").move(2, 0);
    expect(dirty(store, ["rows"])).toBe(false);
    expect(store.changes()).toEqual([]);
  });

  it("gives an inserted item no baseline and makes the array one change", () => {
    const { store, root } = make(rows());
    root.at("rows").insert(1, { t: "new" });
    const [, key] = store.getSnapshot(["rows"]).keys ?? [];
    expect(key).toBe("k3");
    expect(dirty(store, ["rows", "k3"])).toBe(true);
    expect(dirty(store, ["rows", "k1"])).toBe(false);
    expect(dirty(store, ["rows"])).toBe(true);
    expect(store.changes().map((change) => change.path)).toEqual([["rows"]]);
    expect(store.changes(["rows", "k3"])).toEqual([{ path: ["rows", "k3"], baseline: undefined, value: { t: "new" } }]);
  });

  it("makes the array dirty when an item is removed", () => {
    const { store, root } = make(rows());
    root.at("rows").remove(1);
    expect(dirty(store, ["rows"])).toBe(true);
    expect(dirty(store, ["rows", "k2"])).toBe(false);
    expect(store.changes().map((change) => change.path)).toEqual([["rows"]]);
  });

  it("walks item by item while keys and order match the baseline", () => {
    const { store, root } = make(rows());
    root.at("rows").item("k2").at("t").setValue("C");
    root.at("rows").item("k0").at("t").setValue("A");
    expect(store.changes()).toEqual([
      { path: ["rows", "k0", "t"], baseline: "a", value: "A" },
      { path: ["rows", "k2", "t"], baseline: "c", value: "C" },
    ]);
  });

  it("pairs a whole-array write with the keys by index", () => {
    const { store, root } = make({ tags: ["a", "b"] });
    root.at("tags").setValue(["a", "x"]);
    expect(dirty(store, ["tags", "k0"])).toBe(false);
    expect(dirty(store, ["tags", "k1"])).toBe(true);
    expect(store.changes()).toEqual([{ path: ["tags", "k1"], baseline: "b", value: "x" }]);
  });

  it("judges the array by value when a removed item comes back under a new key", () => {
    const { store, root } = make({ tags: ["a", "b"] });
    root.at("tags").remove(1);
    root.at("tags").push("b");
    expect(store.getSnapshot(["tags"]).keys).toEqual(["k0", "k2"]);
    expect(dirty(store, ["tags"])).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.changes()).toEqual([]);
    // The item itself is new, with no baseline.
    expect(dirty(store, ["tags", "k2"])).toBe(true);
  });
});

// Says the object at `a` always differs.
const aDiffers: Equals = (a, b, ctx, next) => (ctx.path.join(".") === "a" ? false : next(a, b));

describe("changes", () => {
  it("lists dirty leaves in value order with stable paths", () => {
    const { store, root } = make({ name: "", tags: [], address: { street: "", city: "" }, extra: 1 });
    root.at("name").setValue("db");
    root.at("tags").push("a");
    root.at("address").at("street").setValue("Main");
    root.setValue({ extra: undefined });
    expect(store.changes()).toEqual([
      { path: ["name"], baseline: "", value: "db" },
      { path: ["tags"], baseline: [], value: ["a"] },
      { path: ["address", "street"], baseline: "", value: "Main" },
      { path: ["extra"], baseline: 1, value: undefined },
    ]);
    expect(store.changes(["address"])).toEqual([{ path: ["address", "street"], baseline: "", value: "Main" }]);
    expect(store.changes(["name"])).toEqual([{ path: ["name"], baseline: "", value: "db" }]);
  });

  it("follows the key order of the current value", () => {
    const { store, root } = make({ a: { x: 1 } });
    root.at("a").setValue({ y: 2, x: 3 }, { replace: true });
    expect(store.changes().map((change) => change.path)).toEqual([["a", "y"], ["a", "x"]]);
  });

  it("is empty for a clean form and a removed item", () => {
    const { store, root } = make({ rows: [{ t: 1 }] });
    expect(store.changes()).toEqual([]);
    root.at("rows").remove(0);
    expect(store.changes(["rows", "k0"])).toEqual([]);
  });

  it("lists a container as one change when its own equals says it differs", () => {
    const { store, root } = make({ a: { x: 1 } }, { equals: aDiffers });
    // The same reference is equal without asking, so write an equal copy.
    root.at("a").setValue({ x: 1 }, { replace: true });
    expect(store.changes()).toEqual([{ path: ["a"], baseline: { x: 1 }, value: { x: 1 } }]);
  });
});

describe("reset", () => {
  it("writes the baseline back and clears state in the subtree, with one wake", () => {
    const { store, root, core } = make({ a: { x: 1, y: 2 }, b: 3 });
    const x = root.at("a").at("x");
    x.setValue(9);
    x.handleBlur();
    x.setErrors(err("user"));
    core.setValidationErrors("v", ["a", "y"], [err("bad")]);
    root.at("b").setValue(4);
    const b = store.getSnapshot(["b"]);
    const runs = count(store, [["a"], ["a", "x"], ["a", "y"], ["b"], [], "form"]);
    root.at("a").reset();
    expect(store.getSnapshot(["a"]).value).toEqual({ x: 1, y: 2 });
    expect(store.getSnapshot(["a", "x"])).toMatchObject({ touched: false, edited: false, dirty: false, errors: [] });
    expect(store.getSnapshot(["a", "y"]).errors).toEqual([]);
    expect(store.getSnapshot(["b"])).toBe(b);
    expect(store.getFormSnapshot().dirty).toBe(true);
    expect(runs).toEqual([1, 1, 1, 0, 1, 1]);
  });

  it("does not count as a user edit", () => {
    const { store, root, validation } = make({ a: 1 });
    root.at("a").setValue(2, { edited: false });
    const written = vi.spyOn(validation, "written");
    root.at("a").reset();
    expect(store.getSnapshot(["a"])).toMatchObject({ value: 1, edited: false, dirty: false });
    expect(written).not.toHaveBeenCalled();
  });

  it("resets the whole form", () => {
    const { store, root } = make({ a: 1, rows: ["x"] });
    root.at("a").setValue(2);
    root.at("rows").push("y");
    store.reset();
    expect(store.getSnapshot([]).value).toEqual({ a: 1, rows: ["x"] });
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.changes()).toEqual([]);
  });

  it("puts array items back by index and keeps the current keys", () => {
    const { store, root } = make({ rows: ["a", "b", "c"] });
    root.at("rows").move(0, 2);
    root.at("rows").remove(0);
    root.at("rows").push("d");
    expect(store.getSnapshot(["rows"]).keys).toEqual(["k2", "k0", "k3"]);
    root.at("rows").reset();
    expect(store.getSnapshot(["rows"])).toMatchObject({ value: ["a", "b", "c"], keys: ["k2", "k0", "k3"], dirty: false });
    expect(store.getSnapshot(["rows", "k2"])).toMatchObject({ value: "a", dirty: false });
    expect(store.getSnapshot(["rows", "k3"])).toMatchObject({ value: "c", dirty: false });
    // The baseline now pairs with these keys, so moves are judged from here.
    root.at("rows").move(2, 0);
    expect(dirty(store, ["rows", "k3"])).toBe(false);
    expect(dirty(store, ["rows"])).toBe(true);
  });

  it("writes undefined to an item the baseline lacks", () => {
    const { store, root } = make({ rows: ["a"] });
    root.at("rows").push("b");
    root.at("rows").item("k1").reset();
    expect(store.getSnapshot(["rows"]).value).toEqual(["a", undefined]);
    expect(dirty(store, ["rows", "k1"])).toBe(false);
    expect(dirty(store, ["rows"])).toBe(true);
  });

  it("goes back to the initial value and moves the baseline there", () => {
    const { store, root, rebase } = make({ a: "one", b: "x" });
    rebase(root, { a: "two", b: "x" }, () => "take");
    expect(store.getFormSnapshot().dirty).toBe(false);
    root.at("a").setValue("three");
    root.at("a").reset();
    expect(store.getSnapshot(["a"]).value).toBe("two");
    root.at("a").reset({ to: "initial" });
    expect(store.getSnapshot(["a"])).toMatchObject({ value: "one", dirty: false });
    expect(store.getFormSnapshot().dirty).toBe(false);
    root.at("a").setValue("two");
    expect(dirty(store, ["a"])).toBe(true);
  });

  it("takes new values, makes them the baseline and clears every field's state", () => {
    const { store, root, core } = make({ name: "old", rows: [{ title: "a" }] });
    root.at("name").setValue("typed");
    root.at("name").handleBlur();
    root.at("name").setErrors(err("user"));
    core.setValidationErrors("v", ["rows", "k0", "title"], [err("bad")]);
    const runs = count(store, ["form"]);
    store.reset({ values: { name: "saved", rows: [{ title: "b" }, { title: "c" }] } });
    expect(store.getSnapshot([]).value).toEqual({ name: "saved", rows: [{ title: "b" }, { title: "c" }] });
    expect(store.getSnapshot(["name"])).toMatchObject({ touched: false, edited: false, dirty: false, errors: [] });
    expect(store.getSnapshot(["rows", "k0", "title"])).toMatchObject({ value: "b", dirty: false, errors: [] });
    expect(store.getFormSnapshot()).toMatchObject({ dirty: false, touched: false, edited: false });
    expect(store.changes()).toEqual([]);
    expect(runs).toEqual([1]);
    // A later reset comes back to the new values, and `to: "initial"` still to the first ones.
    root.at("name").setValue("again");
    root.at("rows").remove(0);
    expect(store.getFormSnapshot().dirty).toBe(true);
    store.reset();
    expect(store.getSnapshot([]).value).toEqual({ name: "saved", rows: [{ title: "b" }, { title: "c" }] });
    expect(store.getFormSnapshot().dirty).toBe(false);
    store.reset({ to: "initial" });
    expect(store.getSnapshot([]).value).toEqual({ name: "old", rows: [{ title: "a" }] });
    expect(store.getFormSnapshot().dirty).toBe(false);
  });

  it("pairs a new array's items with their keys, whatever its length", () => {
    const { store, root } = make({ rows: ["a", "b", "c"] });
    root.at("rows").move(0, 2);
    store.reset({ values: { rows: ["x", "y", "z", "w"] } });
    const keys = store.getSnapshot(["rows"]).keys ?? [];
    expect(keys).toHaveLength(4);
    expect(keys.map((key) => store.getSnapshot(["rows", key])).map((s) => [s.value, s.dirty])).toEqual([
      ["x", false],
      ["y", false],
      ["z", false],
      ["w", false],
    ]);
    // Each item's baseline follows its key from here on.
    root.at("rows").move(3, 0);
    expect(dirty(store, ["rows", keys[3] ?? ""])).toBe(false);
    expect(dirty(store, ["rows"])).toBe(true);
    store.reset({ values: { rows: ["only"] } });
    expect(store.getSnapshot(["rows"]).value).toEqual(["only"]);
    expect(store.getFormSnapshot().dirty).toBe(false);
    root.at("rows").push("more");
    expect(store.changes()).toEqual([{ path: ["rows"], baseline: ["only"], value: ["only", "more"] }]);
  });

  it("replaces nested objects whole, dropping keys the new values lack", () => {
    const { store } = make({ address: { city: "Oslo", zip: "0150" } });
    store.reset({ values: { address: { city: "Bergen" } } });
    expect(store.getSnapshot(["address"]).value).toEqual({ city: "Bergen" });
    expect(store.getSnapshot(["address", "zip"])).toMatchObject({ value: undefined, dirty: false });
    store.root.at("address").at("zip").setValue("5003");
    expect(store.changes()).toEqual([{ path: ["address", "zip"], baseline: undefined, value: "5003" }]);
  });

  it("keeps every container in the baseline frozen through resets and rebases", () => {
    const { baseline, root, rebase } = make({ rows: [{ t: "a", tags: ["x"] }], other: { n: 1 } });
    const check = () => expect(unfrozen(baseline.read([])?.value)).toEqual([]);
    root.at("rows").push({ t: "b", tags: [{}] });
    root.at("rows").item("k1").reset();
    check();
    root.at("rows").item("k0").at("t").setValue("q");
    root.at("rows").item("k0").reset();
    check();
    rebase(root, { rows: [{ t: "c", tags: [[1]] }], other: { n: 2, more: {} } }, () => "take");
    check();
    rebase(root.at("other"), { n: 3, more: { deep: [] } }, () => "take");
    check();
    root.reset({ to: "initial" });
    check();
  });

  it("finds an item's initial value by its first key", () => {
    const { store, root } = make({ rows: ["a", "b"] });
    root.at("rows").move(0, 1);
    root.at("rows").item("k0").setValue("z");
    root.at("rows").item("k0").reset({ to: "initial" });
    expect(store.getSnapshot(["rows"]).value).toEqual(["b", "a"]);
  });
});

describe("cost", () => {
  it("compares only the written row and its ancestors on a keystroke in 2,000 rows", () => {
    const paths: string[] = [];
    const equals: Equals = (a, b, ctx, next) => (paths.push(ctx.path.join(".")), next(a, b));
    const initial = { rows: Array.from({ length: 2000 }, (_, i) => ({ title: `t${i}`, n: i })) };
    const { store, root } = make(initial, { equals });
    const title = root.at("rows").item("k1500").at("title");
    store.subscribeForm(() => {});
    store.subscribe(["rows"], () => {});
    store.subscribe(title.path, () => {});
    store.subscribe(["rows", "k10", "title"], () => {});

    const allowed = new Set(["", "rows", "rows.k1500", "rows.k1500.title"]);
    for (const next of ["x", "xy", "t1500"]) {
      paths.length = 0;
      title.setValue(next);
      expect(paths.filter((path) => !allowed.has(path))).toEqual([]);
      expect(paths.length).toBeLessThan(12);
    }
    expect(store.getFormSnapshot().dirty).toBe(false);
  });

  it("compares only the dirty rows when a second row is typed in", () => {
    const paths: string[] = [];
    const equals: Equals = (a, b, ctx, next) => (paths.push(ctx.path.join(".")), next(a, b));
    const initial = { rows: Array.from({ length: 2000 }, (_, i) => ({ title: `t${i}` })) };
    const { store, root } = make(initial, { equals });
    store.subscribeForm(() => {});
    root.at("rows").item("k3").at("title").setValue("dirty");
    paths.length = 0;
    root.at("rows").item("k1900").at("title").setValue("x");
    expect(paths.some((path) => path.startsWith("rows.k") && !path.startsWith("rows.k3") && !path.startsWith("rows.k1900"))).toBe(false);
    expect(field(store, ["rows", "k1900", "title"]).peek().dirty).toBe(true);
  });
});

/** A store as `make` builds it, without `dirty()`. */
const bare = (initial: unknown, options: Options = {}) => make(initial, { plugins: [arrays(), rebasePlugin()], ...options });

describe("without dirty()", () => {
  it("is never dirty, on the server or the client, and throws for changes()", () => {
    const equals = vi.fn<Equals>((a, b, _ctx, next) => next(a, b));
    const { store, root } = bare({ name: "a", rows: ["x"] }, { equals });
    root.at("name").setValue("b");
    root.at("rows").push("y");
    expect(dirty(store, ["name"])).toBe(false);
    expect(dirty(store, ["rows"])).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.getServerSnapshot(["name"]).dirty).toBe(false);
    expect(() => store.changes()).toThrow(/dirty:missing/);
    expect(equals).not.toHaveBeenCalled();
  });

  it("takes new values on reset with no plugins at all, and comes back to them", () => {
    const { store, root } = make({ a: 1, rows: ["x"] }, { plugins: [] });
    root.at("a").setValue(2);
    root.at("a").handleBlur();
    store.reset({ values: { a: 5, rows: ["y", "z"] } });
    expect(store.getSnapshot(["a"])).toMatchObject({ value: 5, touched: false, edited: false });
    root.at("a").setValue(6);
    root.at("rows").setValue(["w"]);
    store.reset();
    expect(store.getSnapshot([]).value).toEqual({ a: 5, rows: ["y", "z"] });
  });

  it("still resets to the baseline and rebases it", () => {
    const { store, root, rebase } = bare({ name: "a", rows: ["x", "y"] });
    root.at("name").setValue("b");
    root.at("rows").push("w");
    store.reset();
    expect(store.getSnapshot([]).value).toEqual({ name: "a", rows: ["x", "y"] });
    root.at("name").setValue("mine");
    const { taken } = rebase(root, { name: "server", rows: ["x", "z"] }, (leaf) => (leaf.edited ? "keep" : "take"));
    expect(taken).toEqual([["rows", "k1"]]);
    store.reset();
    expect(store.getSnapshot([]).value).toEqual({ name: "server", rows: ["x", "z"] });
  });

  it("compares by reference alone for plugins", () => {
    const { baseline } = bare({ when: new Date(1) });
    expect(baseline.equals(["when"], new Date(1), new Date(1))).toBe(false);
    expect(baseline.equals(["name"], "a", "a")).toBe(true);
  });
});
