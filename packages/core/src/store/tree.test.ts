import { describe, expect, it } from "vitest";
import { changedPaths, copyTree, isContainer, merge, setAt, valueAt } from "./tree.js";

describe("isContainer", () => {
  it("takes arrays and plain objects, and treats everything else as a leaf", () => {
    class Point {
      x = 1;
    }
    expect(isContainer([])).toBe(true);
    expect(isContainer({})).toBe(true);
    expect(isContainer(Object.create(null))).toBe(true);
    for (const leaf of [new Date(), new Map(), new Set(), new Point(), "s", 1, null, undefined, () => 1])
      expect(isContainer(leaf)).toBe(false);
  });
});

describe("valueAt", () => {
  it("reads nested values by key and index", () => {
    expect(valueAt({ a: [{ b: 1 }] }, ["a", 0, "b"])).toBe(1);
    expect(valueAt({ a: 1 }, [])).toEqual({ a: 1 });
  });

  it("returns undefined for a missing step, a leaf step and an inherited name", () => {
    expect(valueAt({ a: undefined }, ["a", "b"])).toBeUndefined();
    expect(valueAt({ a: "text" }, ["a", "length"])).toBeUndefined();
    expect(valueAt({ d: new Date(0) }, ["d", "getTime"])).toBeUndefined();
    expect(valueAt({}, ["constructor"])).toBeUndefined();
  });
});

describe("setAt", () => {
  it("shares untouched branches and leaves the old tree alone", () => {
    const initial = { a: { x: 1 }, b: { y: 2 } };
    const next = setAt(initial, ["a", "x"], 5);
    expect(initial.a.x).toBe(1);
    expect(valueAt(next, ["a", "x"])).toBe(5);
    expect(valueAt(next, ["b"])).toBe(initial.b);
  });

  it("copies arrays as arrays", () => {
    const initial = { list: [{ v: 1 }, { v: 2 }] };
    const next = setAt(initial, ["list", 1, "v"], 3);
    expect(Array.isArray(valueAt(next, ["list"]))).toBe(true);
    expect(next).toEqual({ list: [{ v: 1 }, { v: 3 }] });
    expect(valueAt(next, ["list", 0])).toBe(initial.list[0]);
  });

  it("turns holes in a copied array into undefined items", () => {
    // oxlint-disable-next-line no-sparse-arrays
    const sparse = [1, , 3];
    const next = setAt(sparse, [0], 9);
    expect(next).toEqual([9, undefined, 3]);
    expect(Array.isArray(next) && 1 in next).toBe(true);
    expect(1 in sparse).toBe(false);
  });

  it("creates missing steps on a write", () => {
    expect(setAt({}, ["items", 0, "name"], "x")).toEqual({ items: [{ name: "x" }] });
    expect(setAt(undefined, ["a", "b"], 1)).toEqual({ a: { b: 1 } });
  });

  it("keeps a null prototype and writes `__proto__` as a key", () => {
    const bare: object = Object.create(null);
    expect(Object.getPrototypeOf(setAt(bare, ["a"], 1))).toBeNull();
    const plain = setAt({}, ["__proto__"], { polluted: true });
    expect(Object.getPrototypeOf(plain)).toBe(Object.prototype);
    expect(Object.getOwnPropertyNames(plain)).toEqual(["__proto__"]);
  });

  it("replaces the root for an empty path", () => {
    expect(setAt({ a: 1 }, [], 2)).toBe(2);
  });
});

describe("merge", () => {
  it("writes the patch over a copy one level deep and shares untouched keys", () => {
    const initial = { a: 1, b: { x: 1 } };
    const next = merge(initial, { a: 2 });
    expect(next).toEqual({ a: 2, b: { x: 1 } });
    expect(valueAt(next, ["b"])).toBe(initial.b);
    expect(initial.a).toBe(1);
  });

  it("returns the target when nothing differs", () => {
    const initial = { a: 1, b: undefined };
    expect(merge(initial, { a: 1, b: undefined })).toBe(initial);
    expect(merge(initial, { c: undefined })).toEqual({ a: 1, b: undefined, c: undefined });
  });

  it("starts from an empty object when the target is not a plain object", () => {
    expect(merge(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(merge(undefined, {})).toEqual({});
    expect(merge([1], { a: 1 })).toEqual({ a: 1 });
  });

  it("keeps a null prototype and writes `__proto__` as a key", () => {
    const bare: object = Object.create(null);
    expect(Object.getPrototypeOf(merge(bare, { a: 1 }))).toBeNull();
    const patch: Record<string, unknown> = JSON.parse('{"__proto__":{"polluted":true}}');
    const plain = merge({}, patch);
    expect(Object.getPrototypeOf(plain)).toBe(Object.prototype);
    expect(Object.getOwnPropertyNames(plain)).toEqual(["__proto__"]);
  });
});

describe("copyTree", () => {
  it("makes every array and plain object new and unfrozen, and shares the leaves", () => {
    class Point {
      x = 1;
    }
    const leaves = { date: new Date(0), map: new Map([["a", 1]]), point: new Point() };
    const bare: Record<string, unknown> = Object.assign(Object.create(null), { n: 1 });
    const root = Object.freeze({ rows: Object.freeze([Object.freeze({ title: "a" })]), leaves, bare });
    const copy = copyTree(root);
    expect(copy).toEqual(root);
    expect(copy).not.toBe(root);
    const rows = valueAt(copy, ["rows"]);
    expect(rows).not.toBe(root.rows);
    expect(valueAt(copy, ["rows", 0])).not.toBe(root.rows[0]);
    expect(Object.isFrozen(copy) || Object.isFrozen(rows) || Object.isFrozen(valueAt(copy, ["rows", 0]))).toBe(false);
    expect(valueAt(copy, ["leaves", "date"])).toBe(leaves.date);
    expect(valueAt(copy, ["leaves", "map"])).toBe(leaves.map);
    expect(valueAt(copy, ["leaves", "point"])).toBe(leaves.point);
    expect(Object.getPrototypeOf(valueAt(copy, ["bare"]))).toBe(null);
  });

  it("keeps an own __proto__ key as a key", () => {
    const value = JSON.parse('{"__proto__": {"x": 1}}');
    const copy = copyTree(value);
    expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
    expect(Object.getOwnPropertyNames(copy)).toEqual(["__proto__"]);
  });
});

describe("changedPaths", () => {
  it("names each differing leaf", () => {
    expect(changedPaths({ a: { b: 1, c: 2 } }, { a: { b: 1, c: 3 }, d: 4 })).toEqual([["a", "c"], ["d"]]);
  });

  it("counts an array that changed length as one change", () => {
    expect(changedPaths({ a: 1, b: 2, list: [1, 2] }, { a: 1, b: 3, list: [1, 2, 3] })).toEqual([["b"], ["list"]]);
  });

  it("uses indexes in arrays of the same length and stops at shared references", () => {
    const shared = { deep: { x: 1 } };
    expect(changedPaths({ list: [1, 2], shared }, { list: [1, 5], shared })).toEqual([["list", 1]]);
  });
});
