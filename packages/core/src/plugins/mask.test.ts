import { describe, expect, it } from "vitest";
import { attach } from "../attach.js";
import type { Part, PluginHooks } from "../plugin.js";
import { dirty } from "./dirty.js";
import { digits, mask, type MaskConfig, masked, upper } from "./mask.js";
import { persist } from "./persist.js";
import { rebase } from "./rebase.js";
import { testStore } from "./testing.js";
import { arrays } from "./arrays.js";

interface Account {
  phone: string;
  address: { zip: string; city: string };
  lines: { sku: string }[];
}

const account = (): Account => ({ phone: "(555) 01", address: { zip: "ab 1", city: "x" }, lines: [{ sku: "a-1" }] });

/** A mask pinned at a dotted name, as `.at(name)` makes it. Typed to fit any form, as the test can't type the pin. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const at = (path: string, config: MaskConfig) => ({ ...masked(config), path }) as Part<"mask", unknown>;
const masks = () => [at("phone", { clean: digits }), at("address.zip", { clean: upper })];

/** Masks every row's sku, as a field type's part does when each row renders. */
const maskRows = (store: ReturnType<typeof testStore<Account>>["store"], parts = [masked({ clean: upper })]) => {
  const lines = store.root.at("lines");
  for (const key of lines.peek().keys) attach(lines.item(key).at("sku"), parts);
};

/** Storage backed by a map. */
const memory = (saved = new Map<string, string>()) => ({
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => void saved.set(key, value),
  removeItem: (key: string) => void saved.delete(key),
});

const phone = (value: string) => (value.length > 3 ? `(${value.slice(0, 3)}) ${value.slice(3)}` : value);

type Display = Pick<PluginHooks, "display" | "edit">;
// The host sets the slot to these hooks.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const shown = (meta: Readonly<Record<string, unknown>> | undefined) => meta?.["~display"] as Display | undefined;

describe("mask", () => {
  it("stores the value it cleans", () => {
    const { store, errors } = testStore({ defaultValues: { phone: "" }, plugins: [arrays(), mask()] }, at("phone", { clean: digits }));
    store.root.at("phone").setValue("(555) 01-23");
    expect(store.root.at("phone").peek().value).toBe("5550123");
    expect(errors).toEqual([]);
  });

  it("cleans the starting value, so the baseline is clean and the form starts clean", () => {
    const { store, errors } = testStore({ defaultValues: account(), plugins: [arrays(), dirty(), mask()] }, masks());
    maskRows(store);
    expect(store.getSnapshot([]).value).toEqual({ phone: "55501", address: { zip: "AB 1", city: "x" }, lines: [{ sku: "A-1" }] });
    expect(store.getServerSnapshot([]).value).toEqual(store.getSnapshot([]).value);
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.changes()).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("leaves the form not dirty after a reset from a clean start", () => {
    const { store, errors } = testStore({ defaultValues: account(), plugins: [arrays(), dirty(), mask()] }, masks());
    store.root.at("phone").setValue("9");
    store.reset();
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(store.getSnapshot(["phone"]).value).toBe("55501");
    store.root.at("phone").setValue("9");
    store.reset({ to: "initial" });
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(errors).toEqual([]);
  });

  it("cleans a row added later when its part attaches, on a microtask once the store has listeners", async () => {
    const { store, listen, errors } = testStore({ defaultValues: account(), plugins: [arrays(), mask()] });
    maskRows(store);
    listen();
    const lines = store.root.at("lines");
    lines.push({ sku: "b-2" });
    lines.insert(0, { sku: "c-3" });
    maskRows(store);
    expect(lines.peek().value).toEqual([{ sku: "c-3" }, { sku: "A-1" }, { sku: "b-2" }]);
    await Promise.resolve();
    expect(lines.peek().value).toEqual([{ sku: "C-3" }, { sku: "A-1" }, { sku: "B-2" }]);
    lines.push({ sku: "d-4" });
    expect(lines.peek().value[3]).toEqual({ sku: "d-4" });
    expect(errors).toEqual([]);
  });

  it("attaches a list once per field, however often it is called", () => {
    const { store, records, errors } = testStore({ defaultValues: account(), plugins: [arrays(), mask()] });
    const parts = [masked({ clean: (value) => `${value}!` })];
    maskRows(store, parts);
    maskRows(store, parts);
    expect(store.getSnapshot(["lines"]).value).toEqual([{ sku: "a-1!" }]);
    expect(records.sync).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("cleans the fields below a written parent object or a replaced root", () => {
    const { store, errors } = testStore({ defaultValues: account(), plugins: [arrays(), mask()] }, masks());
    maskRows(store);
    store.root.at("address").setValue({ zip: "cd 2" });
    expect(store.getSnapshot(["address"]).value).toEqual({ zip: "CD 2", city: "x" });
    store.root.setValue({ phone: "1-2", address: { zip: "ef", city: "y" }, lines: [{ sku: "d" }, { sku: "e" }] }, { replace: true });
    // The first row keeps its key, so its part still cleans it. The new row has none yet.
    expect(store.getSnapshot([]).value).toEqual({ phone: "12", address: { zip: "EF", city: "y" }, lines: [{ sku: "D" }, { sku: "e" }] });
    expect(errors).toEqual([]);
  });

  it("writes an untouched parent as it came, the same object", () => {
    const { store, errors } = testStore({ defaultValues: account(), plugins: [arrays(), mask()] }, masks());
    const address = { zip: "CLEAN", city: "z" };
    store.root.at("address").setValue(address, { replace: true });
    expect(store.getSnapshot(["address"]).value).toBe(address);
    expect(errors).toEqual([]);
  });

  it("cleans plugin writes, such as a value persist restores", () => {
    const storage = memory(new Map([["account", JSON.stringify({ ...account(), phone: "(7) 7" })]]));
    const { store, listen, errors } = testStore({ defaultValues: account(), plugins: [arrays(), mask(), persist("account", storage)] }, masks());
    listen();
    expect(store.getSnapshot(["phone"]).value).toBe("77");
    expect(store.getSnapshot(["phone"]).edited).toBe(false);
    expect(errors).toEqual([]);
  });

  it("skips rebase writes, so the baseline moves to the server's copy as it came", () => {
    const { store, errors } = testStore({ defaultValues: account(), plugins: [arrays(), dirty(), mask(), rebase()] }, masks());
    const incoming = { ...account(), phone: "(555) 02" };
    store.plugins.rebase(store.root, incoming, () => "take");
    expect(store.getSnapshot(["phone"]).value).toBe("(555) 02");
    expect(store.getFormSnapshot().dirty).toBe(false);
    expect(errors).toEqual([]);
  });

  it("leaves a value that isn't a string alone", () => {
    const { store, errors } = testStore({ defaultValues: { phone: 5 }, plugins: [arrays(), mask()] }, at("phone", { clean: digits }));
    store.root.at("phone").setValue(7);
    expect(store.getSnapshot(["phone"]).value).toBe(7);
    expect(errors).toEqual([]);
  });

  describe("display", () => {
    it("gives a field with a display its meta, on the server too, and leaves a mask without one out", () => {
      const { store, errors } = testStore({ defaultValues: account(), plugins: [arrays(), mask()] }, at("phone", { clean: digits, display: phone }), at("address.zip", { clean: upper }));
      const display = shown(store.getSnapshot(["phone"]).meta);
      expect(display?.display?.("55501")).toBe("(555) 01");
      expect(display?.edit).toBeTypeOf("function");
      expect(shown(store.getServerSnapshot(["phone"]).meta)).toBe(display);
      expect(store.getSnapshot(["address", "zip"]).meta).toBeUndefined();
      expect(store.getSnapshot(["phone"]).value).toBe("55501");
      expect(errors).toEqual([]);
    });

    it("keeps the meta's identity across writes", () => {
      const { store } = testStore({ defaultValues: account(), plugins: [arrays(), mask()] }, at("phone", { clean: digits, display: phone }));
      const before = shown(store.getSnapshot(["phone"]).meta);
      store.root.at("phone").setValue("(555) 9");
      expect(shown(store.getSnapshot(["phone"]).meta)).toBe(before);
    });

    it("shows a value that isn't a string as empty text", () => {
      const { store } = testStore(
        { defaultValues: { phone: undefined as string | undefined }, plugins: [mask()] },
        at("phone", { clean: digits, display: (value) => `[${value}]` }),
      );
      expect(shown(store.getSnapshot(["phone"]).meta)?.display?.(undefined)).toBe("[]");
    });

    it("gives every row a part attaches to its display", () => {
      const { store, errors } = testStore({ defaultValues: account(), plugins: [arrays(), mask()] });
      const parts = [masked({ clean: upper, display: (value) => `#${value}` })];
      const lines = store.root.at("lines");
      lines.push({ sku: "b" });
      maskRows(store, parts);
      for (const key of lines.peek().keys) expect(shown(store.getSnapshot(["lines", key, "sku"]).meta)?.display?.("B")).toBe("#B");
      expect(lines.peek().keys).toHaveLength(2);
      expect(errors).toEqual([]);
    });

    it("lets the first part at a field own its display", () => {
      const { store, errors } = testStore(
        { defaultValues: account(), plugins: [mask()] },
        at("phone", { clean: (value) => value, display: (value) => `first ${value}` }),
        at("phone", { clean: digits, display: phone }),
      );
      expect(shown(store.getSnapshot(["phone"]).meta)?.display?.("1")).toBe("first 1");
      expect(errors).toEqual([]);
    });
  });
});
