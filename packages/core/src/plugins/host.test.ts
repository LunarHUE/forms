import { describe, expect, it, vi } from "vitest";
import { createFormsCore } from "../index.js";
import { definePlugin } from "../plugins.js";
import { hosts } from "../store/hosts.js";
import { createPluginHost } from "../store/plugins.js";
import type { Path } from "../path.js";
import { arrays } from "./arrays.js";
import { dirty } from "./dirty.js";
import { testStore } from "./testing.js";

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
    const plugin = definePlugin({ name: "p", setup: () => ({}) })();
    const forms = createFormsCore({ plugins: [plugin] });
    forms.define({ defaultValues: { name: "" }, plugins: [definePlugin({ name: "q", setup: () => ({}) })()] }).createStore();
    forms.define({ defaultValues: { name: "" } }).createStore();
    expect(createPluginHost).toHaveBeenCalledTimes(2);
  });

  it("applies writes queued from onSubmitted when the hook returns, with one notification", async () => {
    const plugin = definePlugin({
      name: "p",
      setup: (ctx) => ({
        onSubmitted() {
          ctx.write(() => ctx.store.root.at("name").setValue("saved"));
          ctx.write(() => ctx.store.root.at("email").setValue("saved"));
        },
      }),
    })();
    const store = createFormsCore()
      .define({ defaultValues: { name: "", email: "" }, plugins: [plugin], onSubmit: () => {} })
      .createStore();
    const runs = vi.fn<() => void>();
    store.subscribe([], runs);
    await store.submit();
    expect(store.getSnapshot([]).value).toEqual({ name: "saved", email: "saved" });
    expect(runs).toHaveBeenCalledOnce();
  });
});

describe("onBlur", () => {
  interface Blur {
    readonly name: string;
    readonly path: Path;
    readonly touched: boolean;
    readonly errors: readonly unknown[];
  }

  /** A plugin that records each blur it gets, with the field's touched flag and errors then. With `fail` it throws after. */
  const watcher = (name: string, seen: Blur[], fail?: boolean) =>
    definePlugin({
      name,
      setup: (ctx) => ({
        onBlur(path) {
          const { touched, errors } = ctx.store.getSnapshot(path);
          seen.push({ name, path, touched, errors });
          if (fail) throw new Error("boom");
        },
      }),
    })();

  it("runs on every blur, after the field is touched and validated, with its stable path", () => {
    const seen: Blur[] = [];
    const { store, errors } = testStore({ defaultValues: { name: "" }, plugins: [watcher("watch", seen)] });
    const name = store.root.at("name");
    name.registerValidator((value) => (value === "" ? { message: "Required" } : undefined));
    name.handleBlur();
    name.setValue("a");
    name.handleBlur();
    expect(seen).toEqual([
      { name: "watch", path: ["name"], touched: true, errors: [{ message: "Required" }] },
      { name: "watch", path: ["name"], touched: true, errors: [] },
    ]);
    expect(seen[0]?.path).toBe(name.path);
    expect(errors).toEqual([]);
  });

  it("passes an item's stable path, with its key", () => {
    const paths: Path[] = [];
    const watch = definePlugin({ name: "watch", setup: () => ({ onBlur: (path) => void paths.push(path) }) })();
    const { store } = testStore({ defaultValues: { tags: ["a", "b"] }, plugins: [arrays(), watch] });
    const tags = store.root.at("tags");
    const key = store.getSnapshot(["tags"]).keys?.[1] ?? "";
    tags.item(key).handleBlur();
    expect(paths).toEqual([["tags", key]]);
  });

  it("runs in plugin order, and a throw goes to onPluginError without stopping the others", () => {
    const seen: Blur[] = [];
    const plugins = [watcher("first", seen), watcher("broken", seen, true), watcher("last", seen)];
    const { store, errors } = testStore({ defaultValues: { name: "" }, plugins });
    store.root.at("name").handleBlur();
    expect(seen.map((blur) => blur.name)).toEqual(["first", "broken", "last"]);
    expect(errors).toEqual([{ plugin: "broken", error: new Error("boom") }]);
  });

  it("lands the writes and baseline moves it queues in the blur's batch, with one notification", () => {
    const trim = definePlugin({
      name: "trim",
      setup: (ctx) => ({
        onBlur(path) {
          const value = ctx.store.getSnapshot(path).value;
          if (typeof value !== "string" || value === value.trim()) return;
          ctx.write(() => {
            ctx.store.root.at("name").setValue(value.trim(), { edited: false });
            ctx.baseline.move(path, value.trim());
          });
        },
      }),
    })();
    const { store, errors } = testStore({ defaultValues: { name: "" }, plugins: [dirty(), trim] });
    const name = store.root.at("name");
    name.setValue(" a ");
    const runs = vi.fn<() => void>();
    store.subscribe(["name"], runs);
    name.handleBlur();
    expect(store.getSnapshot(["name"])).toMatchObject({ value: "a", touched: true, dirty: false });
    expect(runs).toHaveBeenCalledOnce();
    expect(errors).toEqual([]);
  });

  it("doesn't run for setTouched or for a field that is gone", () => {
    const paths: Path[] = [];
    const watch = definePlugin({ name: "watch", setup: () => ({ onBlur: (path) => void paths.push(path) }) })();
    const { store } = testStore({ defaultValues: { name: "", tags: ["a"] }, plugins: [arrays(), watch] });
    store.root.at("name").setTouched(true);
    const tags = store.root.at("tags");
    const item = tags.item(store.getSnapshot(["tags"]).keys?.[0] ?? "");
    tags.remove(0);
    item.handleBlur();
    expect(paths).toEqual([]);
  });
});
