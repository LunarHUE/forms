import { expect, it } from "vitest";
import * as core from "@lunarhue/forms-core";
import { encodeSegment, fieldId, splitPath } from "./index.js";

it("re-exports core", () => {
  expect(splitPath).toBe(core.splitPath);
});

it("re-exports core's field id encoder, which radio ids are built from", () => {
  expect(fieldId).toBe(core.fieldId);
  expect(fieldId("signup", ["address", "city"])).toBe("signup--address--city");
  expect(encodeSegment("a b")).toBe("a_20_b");
});
