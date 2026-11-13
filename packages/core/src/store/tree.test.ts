import { describe, expect, it } from "vitest";
import { changedPaths, isContainer, setAt, valueAt } from "./tree.js";

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
