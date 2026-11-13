import { expect, it, vi } from "vitest";

// Loading the runner from here fails the import below, so the test fails if
// the main entry ever imports it, directly or through another module.
vi.mock("./store/validation.js", () => {
  throw new Error("The main entry loaded the validation runner.");
});

it("leaves the validation runner out of the main entry", async () => {
  const core = await import("./index.js");
  expect(core.createFormsCore().define({ defaultValues: { a: "" } }).createStore().root.peek().value).toEqual({ a: "" });
});

it("fails an import that loads the runner, as the validation entry does", async () => {
  // The check above works: the validation entry does load the runner, so its import fails here.
  await expect(import("./validation.js")).rejects.toThrow(/mock/);
});
