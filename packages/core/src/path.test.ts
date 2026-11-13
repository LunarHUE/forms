import { describe, expect, it } from "vitest";
import { splitPath } from "./path.js";

describe("splitPath", () => {
  it("splits keys and turns digit segments into numbers", () => {
    expect(splitPath("items.0.name")).toEqual(["items", 0, "name"]);
  });

  it("returns no segments for an empty path", () => {
    expect(splitPath("")).toEqual([]);
  });

  it("accepts a custom separator", () => {
    expect(splitPath("a/1", "/")).toEqual(["a", 1]);
  });
});
