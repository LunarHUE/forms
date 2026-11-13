import { expect, it, vi } from "vitest";

// Loading the runner or dirty tracking from here fails the import below, so
// the test fails if the main entry ever imports either, directly or through
// another module.
vi.mock("./store/validation.js", () => {
  throw new Error("The main entry loaded the validation runner.");
});
vi.mock("./store/dirty.js", () => {
  throw new Error("The main entry loaded dirty tracking.");
});

it("leaves the validation runner and dirty tracking out of the main entry", async () => {
  const core = await import("./index.js");
  expect(core.createFormsCore().define({ defaultValues: { a: "" } }).createStore().root.peek().value).toEqual({ a: "" });
});

it("fails an import that loads the runner, as the validation entry does", async () => {
  // The check above works: the validation entry does load the runner, so its import fails here.
  await expect(import("./plugins/validation.js")).rejects.toThrow(/mock/);
});

it("fails an import that loads dirty tracking, as the dirty entry does", async () => {
  await expect(import("./plugins/dirty.js")).rejects.toThrow(/mock/);
});
