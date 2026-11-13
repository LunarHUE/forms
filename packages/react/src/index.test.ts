import { expect, it } from "vitest";
import * as core from "@lunarhue/forms-core";
import { splitPath } from "./index.js";

it("re-exports core", () => {
  expect(splitPath).toBe(core.splitPath);
});
