import { describe, expect, it, vi } from "vitest";
import type { Equals } from "../../definition.js";
import type { Path } from "../../path.js";
import { createEquality, defaultEquals } from "./equality.js";
import { indexKeys, type KeyTrie } from "./keys.js";

describe("defaultEquals", () => {
  it("uses Object.is on primitives", () => {
    expect(defaultEquals(1, 1)).toBe(true);
    expect(defaultEquals(Number.NaN, Number.NaN)).toBe(true);
    expect(defaultEquals(0, -0)).toBe(false);
    expect(defaultEquals("a", "b")).toBe(false);
    expect(defaultEquals("", undefined)).toBe(false);
  });

  it("treats a missing key as undefined and null as a value", () => {
    expect(defaultEquals({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(defaultEquals({ a: 1 }, { a: 1, b: null })).toBe(false);
    expect(defaultEquals({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBe(true);
  });

  it("compares arrays in order and dates by timestamp", () => {
    expect(defaultEquals([1, 2], [1, 2])).toBe(true);
    expect(defaultEquals([1, 2], [2, 1])).toBe(false);
    expect(defaultEquals([1], [1, undefined])).toBe(false);
    expect(defaultEquals(new Date(5), new Date(5))).toBe(true);
    expect(defaultEquals(new Date(5), new Date(6))).toBe(false);
    expect(defaultEquals(new Date(Number.NaN), new Date(Number.NaN))).toBe(true);
  });

  it("compares class instances, maps and sets by reference", () => {
    class Point {
      constructor(readonly x: number) {}
    }
    const point = new Point(1);
    expect(defaultEquals(point, point)).toBe(true);
    expect(defaultEquals(new Point(1), new Point(1))).toBe(false);
    expect(defaultEquals(new Map(), new Map())).toBe(false);
    expect(defaultEquals(new Set([1]), new Set([1]))).toBe(false);
    expect(defaultEquals({ a: 1 }, new Point(1))).toBe(false);
  });

  it("tells an array from an object with the same keys", () => {
    expect(defaultEquals([1], { 0: 1 })).toBe(false);
  });
});

// Counts a number equal to its string form.
const loose: Equals = (a, b, _ctx, next) => (typeof a === "number" && typeof b === "string" ? String(a) === b : next(a, b));

describe("createEquality", () => {
  it("agrees with defaultEquals without hooks", () => {
    const { compare } = createEquality(undefined, undefined);
    const cases: [unknown, unknown][] = [
      [{ a: [1, { b: new Date(1) }] }, { a: [1, { b: new Date(1) }] }],
      [{ a: [1, 2] }, { a: [2, 1] }],
      [{ a: 1 }, { a: 1, b: undefined }],
      [null, undefined],
    ];
    for (const [a, b] of cases) expect(compare([], a, b, undefined)).toBe(defaultEquals(a, b));
  });

  it("runs the form's equals, then the shared one, then the default", () => {
    const order: string[] = [];
    const form: Equals = (a, b, _ctx, next) => (order.push("form"), next(a, b));
    const shared: Equals = (a, b, _ctx, next) => (order.push("shared"), next(a, b));
    const { compare } = createEquality(form, shared);
    expect(compare(["x"], 1, 2, undefined)).toBe(false);
    expect(order).toEqual(["form", "shared"]);
  });

  it("lets a link answer without asking the ones after it", () => {
    const shared = vi.fn<Equals>(() => false);
    const { compare } = createEquality(() => true, shared);
    expect(compare([], 1, 2, undefined)).toBe(true);
    expect(shared).not.toHaveBeenCalled();
  });

  it("lets the shared equals answer for the default", () => {
    const { compare } = createEquality((a, b, _ctx, next) => next(a, b), loose);
    expect(compare([], 1, "1", undefined)).toBe(true);
    expect(compare([], { n: 1 }, { n: "1" }, undefined)).toBe(true);
  });

  it("asks the chain at every path the default reaches, with item keys in the path", () => {
    const paths: Path[] = [];
    const form: Equals = (a, b, ctx, next) => (paths.push(ctx.path), next(a, b));
    const { compare } = createEquality(form, undefined);
    const keys: KeyTrie = { list: indexKeys(["k3", "k1"]), children: undefined };
    const shared = { t: 1 };
    compare(["rows"], [shared, { t: 2 }], [shared, { t: 3 }], keys);
    expect(paths).toEqual([["rows"], ["rows", "k1"], ["rows", "k1", "t"]]);
  });

  it("skips the chain for the same reference", () => {
    const form = vi.fn<Equals>((a, b, _ctx, next) => next(a, b));
    const { compare } = createEquality(form, undefined);
    const value = { a: 1 };
    expect(compare([], value, value, undefined)).toBe(true);
    expect(form).not.toHaveBeenCalled();
  });

  it("reuses a container's answer for the same values and path", () => {
    const form = vi.fn<Equals>((a, b, _ctx, next) => next(a, b));
    const { compare, forget } = createEquality(form, undefined);
    const a = { x: 1, y: 2 };
    const b = { x: 1, y: 3 };
    expect(compare(["p"], a, b, undefined)).toBe(false);
    const calls = form.mock.calls.length;
    expect(compare(["p"], a, b, undefined)).toBe(false);
    expect(form.mock.calls.length).toBe(calls);
    expect(compare(["q"], a, b, undefined)).toBe(false);
    expect(form.mock.calls.length).toBeGreaterThan(calls);
    forget();
    const after = form.mock.calls.length;
    compare(["p"], a, b, undefined);
    expect(form.mock.calls.length).toBeGreaterThan(after);
  });

  it("checks the child that differed last time first", () => {
    const paths: string[] = [];
    const form: Equals = (a, b, ctx, next) => (paths.push(ctx.path.join(".")), next(a, b));
    const { compare } = createEquality(form, undefined);
    const baseline = Array.from({ length: 50 }, (_, i) => ({ n: i }));
    const first = baseline.map((item, i) => (i === 40 ? { n: -1 } : item));
    expect(compare([], first, baseline, undefined)).toBe(false);
    paths.length = 0;
    // A new array with item 40 changed again and an earlier item changed too.
    const second = first.map((item, i) => (i === 40 ? { n: -2 } : i === 2 ? { n: -3 } : item));
    expect(compare([], second, baseline, undefined)).toBe(false);
    expect(paths).toEqual(["", "k40", "k40.n"]);
  });
});
