import { expect, it } from "vitest";
import { issuePath } from "./index.js";

it("builds a path through core", () => {
  expect(issuePath("items.0")).toEqual(["items", 0]);
});
