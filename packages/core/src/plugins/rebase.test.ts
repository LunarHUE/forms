import { describe, expect, it, vi } from "vitest";
import type { AnyPlugin } from "../plugin.js";
import type { Path } from "../path.js";
import type { FormStore } from "../store.js";
import { createFormInternals } from "../store/form-store.js";
import { validation as runner } from "./validation.js";
import { type Rebase, rebase as rebasePlugin, type Resolve } from "./rebase.js";

const make = (initial: unknown, plugins: readonly AnyPlugin[] = [runner(), rebasePlugin()]) => {
  const parts = createFormInternals<unknown>({ id: "f", initial, plugins });
  // The internals' store has no typed plugin APIs. The rebase plugin's API is a `Rebase`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const rebase = (parts.store.plugins as { readonly rebase: Rebase }).rebase;
  return { ...parts, root: parts.store.root, rebase };
};

/** Counts listener calls per path. `"form"` counts form listener calls. */
function count(store: FormStore<unknown>, paths: (Path | "form")[]) {
  const runs = paths.map(() => 0);
  for (const [i, path] of paths.entries()) {
    const listener = () => void (runs[i] = (runs[i] ?? 0) + 1);
    if (path === "form") store.subscribeForm(listener);
    else store.subscribe(path, listener);
  }
  return runs;
}

/** A field validator that fails on an empty string with `label`. */
const check = (label: string) =>
  vi.fn<(value: unknown) => { message: string } | undefined>((value) => (value === "" ? { message: label } : undefined));

const paths = (resolve: { mock: { calls: Parameters<Resolve>[] } }) => resolve.mock.calls.map(([leaf]) => leaf.path);

describe("rebase", () => {
  it("asks once per differing leaf and keeps, takes or writes a value", () => {
    const { store, root, rebase } = make({ name: "a", port: 1, same: "s", address: { street: "", city: "" } });
    root.at("name").setValue("mine");
    const resolve = vi.fn<Resolve>((leaf) =>
      leaf.path[0] === "name" ? "keep" : leaf.path[0] === "port" ? "take" : { value: "X" },
    );
    const incoming = { name: "server", port: 2, same: "s", address: { street: "S", city: "" } };
    const { taken } = rebase(root, incoming, resolve);
    expect(paths(resolve)).toEqual([["name"], ["port"], ["address", "street"]]);
    expect(resolve.mock.calls[0]?.[0]).toEqual({ path: ["name"], value: "mine", baseline: "a", incoming: "server", edited: true });
    expect(resolve.mock.calls[1]?.[0]).toMatchObject({ value: 1, baseline: 1, incoming: 2, edited: false });
    expect(taken).toEqual([["port"], ["address", "street"]]);
    expect(store.getSnapshot([]).value).toEqual({ name: "mine", port: 2, same: "s", address: { street: "X", city: "" } });
    expect(store.changes()).toEqual([
      { path: ["name"], baseline: "server", value: "mine" },
      { path: ["address", "street"], baseline: "S", value: "X" },
    ]);
    expect(store.getSnapshot(["port"]).dirty).toBe(false);
    expect(store.getSnapshot(["port"]).edited).toBe(false);
  });

  it("moves the baseline of leaves whose value already equals the incoming one", () => {
    const { store, root, rebase } = make({ a: 1 });
    root.at("a").setValue(2);
    const resolve = vi.fn<Resolve>(() => "keep");
    expect(rebase(root, { a: 2 }, resolve).taken).toEqual([]);
    expect(resolve).not.toHaveBeenCalled();
    expect(store.getFormSnapshot().dirty).toBe(false);
    // Edited stays: only reset clears it.
    expect(store.getSnapshot(["a"]).edited).toBe(true);
  });

  it("wakes each listener once", () => {
    const { store, root, rebase } = make({ a: 1, b: 2, c: 3 });
    store.getFormSnapshot();
    const runs = count(store, [["a"], ["b"], ["c"], [], "form"]);
    rebase(root, { a: 5, b: 6, c: 3 }, () => "take");
    expect(runs).toEqual([1, 1, 0, 1, 0]);
    rebase(root, { a: 7, b: 6, c: 3 }, () => "keep");
    expect(store.getFormSnapshot().dirty).toBe(true);
    expect(runs).toEqual([2, 1, 0, 2, 1]);
  });

  it("leaves siblings of the subtree alone", () => {
    const { store, root, rebase } = make({ a: { x: 1 }, b: { y: 1 } });
    root.at("b").at("y").setValue(2);
    const b = store.getSnapshot(["b"]);
    const y = store.getSnapshot(["b", "y"]);
    const runs = count(store, [["b"], ["b", "y"]]);
    rebase(root.at("a"), { x: 9 }, () => "keep");
    expect(store.getSnapshot(["b"])).toBe(b);
    expect(store.getSnapshot(["b", "y"])).toBe(y);
    expect(runs).toEqual([0, 0]);
    expect(store.changes().map((change) => change.path)).toEqual([["a", "x"], ["b", "y"]]);
    expect(store.changes(["a"])).toEqual([{ path: ["a", "x"], baseline: 9, value: 1 }]);
  });

  it("walks array items by key while the keys match the baseline", () => {
    const { store, root, rebase } = make({ rows: [{ t: "a" }, { t: "b" }] });
    root.at("rows").item("k1").at("t").setValue("mine");
    const resolve = vi.fn<Resolve>(() => "keep");
    rebase(root.at("rows"), [{ t: "A" }, { t: "B" }], resolve);
    expect(paths(resolve)).toEqual([["rows", "k0", "t"], ["rows", "k1", "t"]]);
    expect(store.changes()).toEqual([
      { path: ["rows", "k0", "t"], baseline: "A", value: "a" },
      { path: ["rows", "k1", "t"], baseline: "B", value: "mine" },
    ]);
  });

  it("treats an array that changed length or order as one leaf", () => {
    const { store, root, rebase } = make({ tags: ["a", "b"], rows: ["x", "y"] });
    root.at("rows").move(0, 1);
    const resolve = vi.fn<Resolve>(() => "take");
    const { taken } = rebase(root, { tags: ["a", "b", "c"], rows: ["X", "Y"] }, resolve);
    expect(paths(resolve)).toEqual([["tags"], ["rows"]]);
    expect(taken).toEqual([["tags"], ["rows"]]);
    expect(store.getSnapshot([]).value).toEqual({ tags: ["a", "b", "c"], rows: ["X", "Y"] });
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.getSnapshot(["rows", "k1"])).toMatchObject({ value: "X", dirty: false });
  });

  it("pairs a kept array's items with the baseline's keys", () => {
    const { store, root, rebase } = make({ rows: ["a", "b"] });
    root.at("rows").move(0, 1);
    rebase(root.at("rows"), ["a2", "b2"], () => "keep");
    expect(store.getSnapshot(["rows"]).value).toEqual(["b", "a"]);
    expect(store.changes(["rows", "k0"])).toEqual([{ path: ["rows", "k0"], baseline: "a2", value: "a" }]);
    expect(store.changes(["rows", "k1"])).toEqual([{ path: ["rows", "k1"], baseline: "b2", value: "b" }]);
    store.reset();
    expect(store.getSnapshot(["rows"]).value).toEqual(["a2", "b2"]);
    expect(store.getFormSnapshot().dirty).toBe(false);
  });

  it("adds an item the baseline lacks where it sits now", () => {
    const { store, root, rebase } = make({ rows: ["a", "b"] });
    root.at("rows").insert(1, "new");
    rebase(root.at("rows").item("k2"), "new", () => "keep");
    expect(store.getSnapshot(["rows", "k2"]).dirty).toBe(false);
    expect(store.getSnapshot(["rows"]).dirty).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(false);
  });

  it("makes reset go to the new baseline", () => {
    const { store, root, rebase } = make({ a: 1, b: { c: 1 } });
    rebase(root, { a: 2, b: { c: 2 } }, () => "keep");
    expect(store.getFormSnapshot().dirty).toBe(true);
    store.reset();
    expect(store.getSnapshot([]).value).toEqual({ a: 2, b: { c: 2 } });
    expect(store.getFormSnapshot().dirty).toBe(false);
    store.reset({ to: "initial" });
    expect(store.getSnapshot([]).value).toEqual({ a: 1, b: { c: 1 } });
    expect(store.getFormSnapshot().dirty).toBe(false);
  });

  it("treats a leaf that becomes an object as one leaf", () => {
    const { root, rebase } = make({ a: null });
    const resolve = vi.fn<Resolve>(() => "take");
    rebase(root, { a: { x: 1, y: 2 } }, resolve);
    expect(paths(resolve)).toEqual([["a"]]);
  });

  it("does nothing on a removed item", () => {
    const { root, rebase } = make({ rows: ["a"] });
    const item = root.at("rows").item("k0");
    root.at("rows").remove(0);
    const resolve = vi.fn<Resolve>(() => "take");
    expect(rebase(item, "b", resolve).taken).toEqual([]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("reruns armed validators on the taken paths, in its batch, and arms nothing", () => {
    const a = check("a");
    const b = check("b");
    const c = check("c");
    const { store, root, rebase } = make({ a: "x", b: "x", c: "x" });
    store.registerValidator(["a"], a);
    store.registerValidator(["b"], b);
    store.registerValidator(["c"], c);
    // Armed by blur: a and c. b never armed.
    store.fieldAt(["a"])?.handleBlur();
    store.fieldAt(["c"])?.handleBlur();
    a.mockClear();
    c.mockClear();
    const runs = count(store, [["a"], ["b"]]);
    const { taken } = rebase(root, { a: "", b: "", c: "" }, (leaf) => (leaf.path[0] === "c" ? "keep" : "take"));
    expect(taken).toEqual([["a"], ["b"]]);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(c).not.toHaveBeenCalled();
    expect(store.getSnapshot(["a"]).errors).toEqual([{ message: "a" }]);
    expect(store.getSnapshot(["b"]).errors).toEqual([]);
    // The value and the error land in one wake.
    expect(runs).toEqual([1, 1]);
    // b is still waiting for its blur.
    store.fieldAt(["b"])?.setValue("");
    expect(b).not.toHaveBeenCalled();
  });

  it("rejects a handle from something that isn't a form store", () => {
    const { root, rebase } = make({});
    const fake = { ...root, store: { ...root.store } };
    expect(() => rebase(fake, {}, () => "keep")).toThrow(TypeError);
  });

  it("rejects a handle from another store", () => {
    const { rebase } = make({ a: 1 });
    const other = make({ a: 1 });
    expect(() => rebase(other.root, { a: 2 }, () => "take")).toThrow(TypeError);
    expect(other.store.getSnapshot(["a"]).value).toBe(1);
  });

  it("works without the validation runner, and revalidates nothing", () => {
    const { store, root, rebase } = make({ a: "x", b: { c: "x" } }, [rebasePlugin()]);
    root.at("a").setValue("mine");
    const { taken } = rebase(root, { a: "server", b: { c: "y" } }, (leaf) => (leaf.edited ? "keep" : "take"));
    expect(taken).toEqual([["b", "c"]]);
    expect(store.getSnapshot([]).value).toEqual({ a: "mine", b: { c: "y" } });
    expect(store.getSnapshot(["b", "c"])).toMatchObject({ dirty: false, edited: false, errors: [] });
    expect(store.changes()).toEqual([{ path: ["a"], baseline: "server", value: "mine" }]);
  });

  it("writes a function value as it is", () => {
    const { store, root, rebase } = make({ fn: null });
    const fn = vi.fn<() => void>();
    rebase(root, { fn }, () => "take");
    expect(store.getSnapshot(["fn"]).value).toBe(fn);
  });
});
