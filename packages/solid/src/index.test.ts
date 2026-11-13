import { expect, it } from "vitest";
import * as core from "@lunarhue/forms-core";
import * as solid2 from "./index.js";
import * as solid1 from "./v1.js";

it("re-exports core from both entry points", () => {
  expect(solid2.splitPath).toBe(core.splitPath);
  expect(solid1.splitPath).toBe(core.splitPath);
});
