import { expect, it } from "vitest";
import * as core from "@lunarhue/forms-core";
import * as solid from "./index.js";

it("re-exports core", () => {
  expect(solid.splitPath).toBe(core.splitPath);
});
