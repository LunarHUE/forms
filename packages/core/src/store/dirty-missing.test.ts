import { describe, expect, it } from "vitest";
import { dirty } from "../plugins/dirty.js";
import { createFormStore, type FormStoreOptions } from "./form-store.js";

// Core has no node types, so this declares the global the tests use.
declare const process: { env: Record<string, string | undefined> };

type Options = Omit<FormStoreOptions<unknown>, "id" | "initial">;

// The store's types always have `changes`, so these calls compile. A form's
// store has it only with `dirty()`, and these are the callers without types.
const make = (options: Options = {}) => createFormStore<unknown>({ id: "f", initial: { name: "a" }, ...options });

describe("changes() without dirty tracking", () => {
  it("throws dirty:missing in development", () => {
    const store = make();
    expect(() => store.changes()).toThrow(/dirty:missing/);
    expect(() => store.changes()).toThrow(/Add `dirty\(\)`/);
  });

  it("returns the changes with `dirty()`", () => {
    const store = make({ plugins: [dirty()] });
    store.root.at("name").setValue("b");
    expect(store.changes()).toHaveLength(1);
  });

  it("returns nothing in production", () => {
    const before = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";
    try {
      const store = make();
      store.root.at("name").setValue("b");
      expect(store.changes()).toEqual([]);
    } finally {
      process.env["NODE_ENV"] = before;
    }
  });

  it("leaves `dirty` false on the snapshots, without throwing", () => {
    const store = make();
    store.root.at("name").setValue("b");
    expect(store.getSnapshot(["name"]).dirty).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(false);
  });
});
