import { describe, expect, it } from "vitest";
import { dirty } from "./dirty.js";
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
});
