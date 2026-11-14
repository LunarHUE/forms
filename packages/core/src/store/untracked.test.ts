import { afterEach, describe, expect, it, vi } from "vitest";
import { dirty } from "../plugins/dirty.js";
import { createFormStore, type FormStoreOptions } from "./form-store.js";

// Core has no node types, so this declares the globals the tests use.
declare const process: { env: Record<string, string | undefined> };
declare const console: { warn(message: string): void };

type Options = Omit<FormStoreOptions<unknown>, "id" | "initial">;

const make = (options: Options = {}) => createFormStore<unknown>({ id: "f", initial: { name: "a" }, ...options });

const warnings = () => vi.spyOn(console, "warn").mockImplementation(() => {});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("changes() without dirty tracking", () => {
  it("warns once per store", () => {
    const warn = warnings();
    const store = make();
    expect(store.changes()).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.lastCall?.[0]).toMatch(/dirty:untracked/);
    expect(warn.mock.lastCall?.[0]).toMatch(/Add `dirty\(\)`/);
    store.root.at("name").setValue("b");
    expect(store.changes()).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("warns again for a second store", () => {
    const warn = warnings();
    make().changes();
    make().changes();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("doesn't warn with `dirty()`", () => {
    const warn = warnings();
    expect(make({ plugins: [dirty()] }).changes()).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("doesn't warn in production", () => {
    const warn = warnings();
    const before = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";
    try {
      expect(make().changes()).toEqual([]);
    } finally {
      process.env["NODE_ENV"] = before;
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it("doesn't warn when only `dirty` is read", () => {
    const warn = warnings();
    const store = make();
    expect(store.getSnapshot(["name"]).dirty).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
