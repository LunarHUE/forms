import { describe, expectTypeOf, it } from "vitest";
import { splitPath, type PathSegment } from "./index.js";

describe("splitPath types", () => {
  it("takes a string and returns readonly segments", () => {
    expectTypeOf(splitPath).parameter(0).toEqualTypeOf<string>();
    expectTypeOf(splitPath("a")).toEqualTypeOf<readonly PathSegment[]>();
    expectTypeOf<PathSegment>().toEqualTypeOf<string | number>();
  });
});
