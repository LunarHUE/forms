import { describe, expectTypeOf, it } from "vitest";
import type { ArrayPath, FieldPath, ValueAt } from "./index.js";

interface Value {
  name: string;
  address?: { city: string; geo: { lat: number } };
  rows: { title: string }[];
  shape: { kind: "a"; x: number } | { kind: "b"; y: string };
}

type Deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: string } } } } } } } } } };

describe("FieldPath", () => {
  it("lists dotted names through objects, stopping at arrays", () => {
    expectTypeOf<FieldPath<Value>>().toEqualTypeOf<
      | "name"
      | "address"
      | "address.city"
      | "address.geo"
      | "address.geo.lat"
      | "rows"
      | "shape"
      | "shape.kind"
      | "shape.x"
      | "shape.y"
    >();
  });

  it("stops at PathMaxDepth segments", () => {
    expectTypeOf<"a.b.c.d.e.f.g.h">().toExtend<FieldPath<Deep>>();
    expectTypeOf<"a.b.c.d.e.f.g.h.i">().not.toExtend<FieldPath<Deep>>();
  });

  it("resolves the value type at a name, with undefined from optional parents and missing union keys", () => {
    expectTypeOf<ValueAt<Value, "address.geo.lat">>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ValueAt<Value, "shape.x">>().toEqualTypeOf<number | undefined>();
    expectTypeOf<ValueAt<Value, "rows">>().toEqualTypeOf<{ title: string }[]>();
  });

  it("lists array names for Items", () => {
    expectTypeOf<ArrayPath<Value>>().toEqualTypeOf<"rows">();
  });
});
