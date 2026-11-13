import { describe, expect, it, vi } from "vitest";
import { createFormsCore } from "../index.js";
import { definePlugin } from "../plugins.js";
import { partsOf } from "../store/baseline/registry.js";
import { createPluginHost } from "../store/plugins.js";

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
    expect(partsOf(plain)?.host).toBeUndefined();
    expect(partsOf(empty)?.host).toBeUndefined();
  });

  it("is made once per store with plugins", () => {
    vi.mocked(createPluginHost).mockClear();
    const plugin = definePlugin({ name: "p", setup: () => ({}) });
    const forms = createFormsCore({ plugins: [plugin] });
    forms.define({ defaultValues: { name: "" }, plugins: [definePlugin({ name: "q", setup: () => ({}) })] }).createStore();
    forms.define({ defaultValues: { name: "" } }).createStore();
    expect(createPluginHost).toHaveBeenCalledTimes(2);
  });
});
