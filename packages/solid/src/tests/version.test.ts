import * as solid from "solid-js";
import { describe, expect, it } from "vitest";
import * as calls from "#solid";
import { major } from "./solid.js";

describe("Solid version", () => {
  it("runs on the major its project names, with that major's calls", () => {
    // Only Solid 1 has `mergeProps`, and only Solid 2 has `merge`.
    expect(Reflect.has(solid, "mergeProps")).toBe(major === 1);
    expect(calls.merge).toBe(Reflect.get(solid, major === 1 ? "mergeProps" : "merge"));
  });
});
