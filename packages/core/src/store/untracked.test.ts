import { afterEach, describe, expect, it, vi } from "vitest";
import type { Show } from "../errors.js";
import { dirty } from "../plugins/dirty.js";
import { createStoreCore } from "./core.js";
import { createFormStore, type FormStoreOptions } from "./form-store.js";

// Core has no node or DOM types, so this declares the globals the tests use.
declare const process: { env: Record<string, string | undefined> };
declare const console: { warn(message: string): void };
declare function structuredClone<T>(value: T): T;

type Options = Omit<FormStoreOptions<unknown>, "id" | "initial">;

const make = (options: Options = {}) => createFormStore<unknown>({ id: "f", initial: { name: "a", rows: ["x"] }, ...options });

const warnings = () => vi.spyOn(console, "warn").mockImplementation(() => {});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dirty without tracking", () => {
  it("warns once per store when a field's or the form's `dirty` is read", () => {
    const warn = warnings();
    const store = make();
    expect(store.getSnapshot(["name"]).dirty).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.lastCall?.[0]).toMatch(/dirty:untracked/);
    expect(warn.mock.lastCall?.[0]).toMatch(/Add `dirty\(\)`/);

    store.root.at("name").setValue("b");
    expect(store.getSnapshot(["name"]).dirty).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.getServerFormSnapshot().dirty).toBe(false);
    expect(warn).toHaveBeenCalledOnce();

    expect(make().getFormSnapshot().dirty).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("warns when `changes()` is called", () => {
    const warn = warnings();
    const store = make();
    expect(store.changes()).toEqual([]);
    expect(store.getSnapshot([]).dirty).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("warns when a `show` function reads `dirty`", () => {
    const warn = warnings();
    const show = vi.fn<Exclude<Show, string>>((ctx) => ctx.touched);
    const store = createStoreCore({ id: "f", initial: { a: 1 }, show });
    store.setValidationErrors("v", ["a"], [{ message: "x" }]);
    expect(store.getSnapshot(["a"]).shownErrors).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    show.mockImplementation((ctx) => ctx.dirty);
    store.setTouched(["a"], true);
    expect(store.getSnapshot(["a"]).shownErrors).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("doesn't warn when a snapshot is only copied", () => {
    const warn = warnings();
    const store = make();
    const field = store.getSnapshot(["name"]);
    const form = store.getFormSnapshot();
    const copies = [{ ...field }, { ...form }, Object.assign({}, field), structuredClone(form)];
    expect(Object.keys(field)).not.toContain("dirty");
    expect(JSON.parse(JSON.stringify(form))).not.toHaveProperty("dirty");
    for (const copy of copies) expect(copy).not.toHaveProperty("dirty");
    expect("dirty" in field).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("doesn't warn with `dirty()`, and `dirty` is a plain member", () => {
    const warn = warnings();
    const store = make({ plugins: [dirty()] });
    expect(store.getSnapshot(["name"]).dirty).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.changes()).toEqual([]);
    expect(Object.keys(store.getSnapshot(["name"]))).toContain("dirty");
    expect(warn).not.toHaveBeenCalled();
  });

  it("does nothing in production", () => {
    const warn = warnings();
    const before = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";
    try {
      const store = make();
      expect(store.getSnapshot(["name"]).dirty).toBe(false);
      expect(store.getFormSnapshot().dirty).toBe(false);
      expect(store.changes()).toEqual([]);
      expect(Object.keys(store.getSnapshot(["name"]))).toContain("dirty");
    } finally {
      process.env["NODE_ENV"] = before;
    }
    expect(warn).not.toHaveBeenCalled();
  });
});
