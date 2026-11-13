import { describe, expect, it, vi } from "vitest";
import { createFormsCore } from "../index.js";
import type { WriteRecord } from "../plugin.js";
import { definePlugin, flushPlugins } from "../plugins.js";
import { createPluginHost, hosts } from "../store/plugins.js";
import { history } from "./history.js";
import { digits, mask } from "./mask.js";
import { rebase } from "./rebase.js";

// Every host is made through this spy, so a test can count them.
vi.mock(import("../store/plugins.js"), async (original) => {
  const actual = await original();
  return { ...actual, createPluginHost: vi.fn<typeof actual.createPluginHost>(actual.createPluginHost) };
});

describe("the plugin host", () => {
  it("is never made for a store without plugins", () => {
    vi.mocked(createPluginHost).mockClear();
    const plain = createFormsCore().define({ defaultValues: { name: "" } }).createStore();
    const empty = createFormsCore({ plugins: [] }).define({ defaultValues: { name: "" }, plugins: [] }).createStore();
    plain.root.at("name").setValue("a");
    empty.root.at("name").setValue("a");
    expect(createPluginHost).not.toHaveBeenCalled();
    expect(hosts.has(plain)).toBe(false);
    expect(hosts.has(empty)).toBe(false);
  });

  it("is made once per store with plugins", () => {
    vi.mocked(createPluginHost).mockClear();
    const plugin = definePlugin({ name: "p", setup: () => ({}) });
    const forms = createFormsCore({ plugins: [plugin] });
    forms.define({ defaultValues: { name: "" }, plugins: [definePlugin({ name: "q", setup: () => ({}) })] }).createStore();
    forms.define({ defaultValues: { name: "" } }).createStore();
    expect(createPluginHost).toHaveBeenCalledTimes(2);
  });

  it("runs every hook its plugins bring parts for, whichever plugin comes first", () => {
    const seen: WriteRecord[] = [];
    const upper = definePlugin({
      name: "upper",
      setup: () => ({
        beforeWrite: (write) => (typeof write.value === "string" ? write.value.toUpperCase() : write.value),
        onWrite: (records) => void seen.push(...records),
      }),
    });
    const store = createFormsCore({ plugins: [rebase(), upper] }).define({ defaultValues: { name: "" } }).createStore();
    store.root.at("name").setValue("ada");
    expect(store.getSnapshot(["name"]).value).toBe("ADA");
    expect(seen.map((record) => record.type === "value" && record.after)).toEqual(["ADA"]);
  });

  it("joins the parts of two first-class plugins", () => {
    const undo = history();
    const store = createFormsCore({ plugins: [mask({ phone: digits }), undo] }).define({ defaultValues: { phone: "" } }).createStore();
    store.root.at("phone").setValue("5-5");
    flushPlugins(store);
    expect(store.getSnapshot(["phone"]).value).toBe("55");
    expect(store.plugins.history.undo()).toBe(true);
    expect(store.getSnapshot(["phone"]).value).toBe("");
  });
});
