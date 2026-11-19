import { expect, it, vi } from "vitest";

// Loading dirty tracking from here fails the import below, so the test fails
// if the main entry ever imports it, directly or through another module.
vi.mock("./store/dirty.js", () => {
  throw new Error("The main entry loaded dirty tracking.");
});

it("leaves dirty tracking out of the main entry", async () => {
  const core = await import("./index.js");
  expect(core.createFormsCore().define({ defaultValues: { a: "" } }).createStore().root.peek().value).toEqual({ a: "" });
});

it("fails an import that loads dirty tracking, as the plugins entry does", async () => {
  await expect(import("./plugins/index.js")).rejects.toThrow(/mock/);
});
