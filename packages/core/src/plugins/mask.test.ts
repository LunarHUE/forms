import { describe, expect, it } from "vitest";
import { dirty } from "./dirty.js";
import type { FieldDisplay } from "../plugin.js";
import { digits, mask, upper } from "./mask.js";
import { persist } from "./persist.js";
import { rebase } from "./rebase.js";
import { testStore } from "./testing.js";

interface Account {
  phone: string;
  address: { zip: string; city: string };
  lines: { sku: string }[];
}

const account = (): Account => ({ phone: "(555) 01", address: { zip: "ab 1", city: "x" }, lines: [{ sku: "a-1" }] });
const masks = () => mask({ phone: digits, "address.zip": upper, "lines.*.sku": upper });

/** Storage backed by a map. */
const memory = (saved = new Map<string, string>()) => ({
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => void saved.set(key, value),
  removeItem: (key: string) => void saved.delete(key),
});

const phone = (value: string) => (value.length > 3 ? `(${value.slice(0, 3)}) ${value.slice(3)}` : value);

/** The slots of a field's meta that are a `FieldDisplay`, in order. */
const displays = (meta: Readonly<Record<string, unknown>> | undefined) =>
  Object.values(meta ?? {}).filter((slot): slot is FieldDisplay => typeof slot === "object" && slot !== null && "display" in slot);

describe("mask", () => {
  it("stores the value it cleans", () => {
    const { store, errors } = testStore({ defaultValues: { phone: "" }, plugins: [mask({ phone: digits })] });
    store.root.at("phone").setValue("(555) 01-23");
    expect(store.root.at("phone").peek().value).toBe("5550123");
    expect(errors).toEqual([]);
  });

  it("cleans the starting value, so the baseline is clean and the form starts clean", () => {
    const { store, errors } = testStore({ defaultValues: account(), plugins: [dirty(), masks()] });
    expect(store.getSnapshot([]).value).toEqual({ phone: "55501", address: { zip: "AB 1", city: "x" }, lines: [{ sku: "A-1" }] });
    expect(store.getServerSnapshot([]).value).toEqual(store.getSnapshot([]).value);
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.changes()).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("leaves the form not dirty after a reset from a clean start", () => {
    const { store, errors } = testStore({ defaultValues: account(), plugins: [dirty(), masks()] });
    store.root.at("phone").setValue("9");
    store.reset();
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.getSnapshot(["phone"]).value).toBe("55501");
    store.root.at("phone").setValue("9");
    store.reset({ to: "initial" });
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(errors).toEqual([]);
  });

  it("cleans a row push and insert add", () => {
    const { store, errors } = testStore({ defaultValues: account(), plugins: [masks()] });
    const lines = store.root.at("lines");
    lines.push({ sku: "b-2" });
    lines.insert(0, { sku: "c-3" });
    expect(lines.peek().value).toEqual([{ sku: "C-3" }, { sku: "A-1" }, { sku: "B-2" }]);
    expect(errors).toEqual([]);
  });

  it("cleans the fields below a written parent object or a replaced root", () => {
    const { store, errors } = testStore({ defaultValues: account(), plugins: [masks()] });
    store.root.at("address").setValue({ zip: "cd 2" });
    expect(store.getSnapshot(["address"]).value).toEqual({ zip: "CD 2", city: "x" });
    store.root.setValue({ phone: "1-2", address: { zip: "ef", city: "y" }, lines: [{ sku: "d" }, { sku: "e" }] }, { replace: true });
    expect(store.getSnapshot([]).value).toEqual({ phone: "12", address: { zip: "EF", city: "y" }, lines: [{ sku: "D" }, { sku: "E" }] });
    expect(errors).toEqual([]);
  });

  it("writes an untouched parent as it came, the same object", () => {
    const { store, errors } = testStore({ defaultValues: account(), plugins: [masks()] });
    const address = { zip: "CLEAN", city: "z" };
    store.root.at("address").setValue(address, { replace: true });
    expect(store.getSnapshot(["address"]).value).toBe(address);
    expect(errors).toEqual([]);
  });

  it("cleans plugin writes, such as a value persist restores", () => {
    const storage = memory(new Map([["account", JSON.stringify({ ...account(), phone: "(7) 7" })]]));
    const { store, listen, errors } = testStore({ defaultValues: account(), plugins: [masks(), persist("account", storage)] });
    listen();
    expect(store.getSnapshot(["phone"]).value).toBe("77");
    expect(store.getSnapshot(["phone"]).edited).toBe(false);
    expect(errors).toEqual([]);
  });

  it("skips rebase writes, so the baseline moves to the server's copy as it came", () => {
    const { store, errors } = testStore({ defaultValues: account(), plugins: [dirty(), masks(), rebase()] });
    const incoming = { ...account(), phone: "(555) 02" };
    store.plugins.rebase(store.root, incoming, () => "take");
    expect(store.getSnapshot(["phone"]).value).toBe("(555) 02");
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(errors).toEqual([]);
  });

  describe("display", () => {
    it("gives a field with a display its meta, on the server too, and leaves the short form without", () => {
      const plugin = mask({ phone: { clean: digits, display: phone }, "address.zip": upper });
      const { store, errors } = testStore({ defaultValues: account(), plugins: [plugin] });
      const shown = plugin.meta(store.getSnapshot(["phone"]));
      expect(shown?.display("55501")).toBe("(555) 01");
      expect(plugin.meta(store.getServerSnapshot(["phone"]))).toBe(shown);
      expect(store.getSnapshot(["address", "zip"]).meta).toBeUndefined();
      expect(store.getSnapshot(["phone"]).value).toBe("55501");
      expect(errors).toEqual([]);
    });

    it("keeps the meta's identity across writes", () => {
      const plugin = mask({ phone: { clean: digits, display: phone } });
      const { store } = testStore({ defaultValues: account(), plugins: [plugin] });
      const before = plugin.meta(store.getSnapshot(["phone"]));
      store.root.at("phone").setValue("(555) 9");
      expect(plugin.meta(store.getSnapshot(["phone"]))).toBe(before);
    });

    it("shows a value that isn't a string as empty text", () => {
      const plugin = mask({ phone: { clean: digits, display: (value) => `[${value}]` } });
      const { store } = testStore({ defaultValues: { phone: undefined as string | undefined }, plugins: [plugin] });
      expect(plugin.meta(store.getSnapshot(["phone"]))?.display(undefined)).toBe("[]");
    });

    it("gives every item a `*` matches its display, rows added later included", () => {
      const plugin = mask({ "lines.*.sku": { clean: upper, display: (value) => `#${value}` } });
      const { store, errors } = testStore({ defaultValues: account(), plugins: [plugin] });
      const lines = store.root.at("lines");
      lines.push({ sku: "b" });
      for (const key of lines.peek().keys) {
        expect(plugin.meta(store.getSnapshot(["lines", key, "sku"]))?.display("B")).toBe("#B");
      }
      expect(lines.peek().keys).toHaveLength(2);
      expect(errors).toEqual([]);
    });

    it("lets the first of two masks own a field's display", () => {
      const first = mask({ phone: { clean: digits, display: phone } });
      const second = mask({ phone: { clean: upper, display: (value) => `second ${value}` } }, { name: "second" });
      const { store, errors } = testStore({ defaultValues: account(), plugins: [second, first] });
      // `second` is listed first, so it runs first and its slot comes first.
      const [owner, other] = displays(store.getSnapshot(["phone"]).meta);
      expect(owner?.display("1")).toBe("second 1");
      expect(other?.display("1234")).toBe("(123) 4");
      expect(errors).toEqual([]);
    });
  });
});
