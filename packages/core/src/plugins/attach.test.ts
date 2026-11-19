import { describe, expect, it } from "vitest";
import { attach } from "../attach.js";
import { createFormsCore } from "../index.js";
import type { Part, Path, PluginContext } from "../index.js";
import type { Attachment } from "../plugin.js";
import { definePlugin, refuse } from "../plugins.js";
import { dirty } from "./dirty.js";
import { testStore } from "./testing.js";
import { arrays } from "./arrays.js";

/** A plugin that records what each attach saw, and adds its config to each write. */
const tagger = (seen: { path: Path; config: unknown }[] = []) =>
  definePlugin({
    name: "tag",
    attach(ctx: PluginContext, config: string) {
      seen.push({ path: ctx.path, config });
      return { beforeWrite: (write) => (typeof write.value === "string" ? `${write.value}${config}` : write.value) };
    },
  });
const tag = (config: string, path?: string) => ({ plugin: "tag", config, ...(path && { path }) }) as Part<"tag", unknown>;

describe("attach", () => {
  it("runs attach once per path, with the context's path", () => {
    const seen: { path: Path; config: unknown }[] = [];
    const { store, errors } = testStore({ defaultValues: { a: { b: "" } }, plugins: [arrays(), tagger(seen)] }, tag("!", "a.b"));
    expect(seen).toEqual([{ path: ["a", "b"], config: "!" }]);
    store.root.at("a").at("b").setValue("x");
    expect(store.getSnapshot(["a", "b"]).value).toBe("x!");
    expect(errors).toEqual([]);
  });

  it("attaches a pinned copy of a part once with the part", () => {
    const seen: { path: Path; config: unknown }[] = [];
    const part = tag("!");
    const pinned: Part<"tag", unknown> = { ...part, path: "a", "~of": part };
    const { store } = testStore({ defaultValues: { a: "" }, plugins: [arrays(), tagger(seen)] }, pinned);
    attach(store.root.at("a"), [part]);
    expect(seen).toEqual([{ path: ["a"], config: "!" }]);
  });

  it("walks a write above the path down to it, and leaves the rest of the write alone", () => {
    const { store, errors } = testStore({ defaultValues: { a: { b: "", c: "" } }, plugins: [arrays(), tagger()] }, tag("!", "a.b"));
    store.root.setValue({ a: { b: "x", c: "y" } });
    expect(store.getSnapshot([]).value).toEqual({ a: { b: "x!", c: "y" } });
    expect(errors).toEqual([]);
  });

  it("refuses the whole write when a hook below it refuses", () => {
    const refusing = definePlugin({
      name: "tag",
      attach: (_ctx: PluginContext, _config: string) => ({ beforeWrite: (write) => (write.value === "no" ? refuse : write.value) }),
    });
    const { store } = testStore({ defaultValues: { a: { b: "", c: "" } }, plugins: [arrays(), refusing] }, tag("", "a.b"));
    store.root.at("a").setValue({ b: "no", c: "y" });
    expect(store.getSnapshot(["a"]).value).toEqual({ b: "", c: "" });
  });

  it("drops an attachment whose field is gone", () => {
    const { store, errors } = testStore({ defaultValues: { rows: [{ name: "" }] }, plugins: [arrays(), tagger()] });
    const rows = store.root.at("rows");
    const [key] = rows.peek().keys;
    attach(rows.item(key!).at("name"), [tag("!")]);
    rows.remove(0);
    rows.push({ name: "x" });
    expect(rows.peek().value).toEqual([{ name: "x" }]);
    expect(errors).toEqual([]);
  });

  it("throws plugins:missing for a part whose plugin the store lacks", () => {
    const forms = createFormsCore({ plugins: [arrays(), arrays()] });
    // The cast skips the type error, to reach the runtime check.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    expect(() => forms.define({ defaultValues: { a: "" } }, tag("!") as never).createStore()).toThrow(/Add tag\(\) to this form's plugins/);
    const store = createFormsCore({ plugins: [arrays(), dirty()] }).define({ defaultValues: { a: "" } }).createStore();
    expect(() => attach(store.root, [tag("!")])).toThrow(/core:plugins:missing/);
  });
});

const counter = () => definePlugin({ name: "counter", setup: () => ({ api: { count: 1 } }) });

describe("requires", () => {
  it("throws plugins:missing when a required plugin isn't there", () => {
    const autosave = definePlugin({ name: "autosave", requires: () => [counter], setup: () => ({}) });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    expect(() => createFormsCore({ plugins: [arrays(), autosave] as never }).define({ defaultValues: {} }).createStore()).toThrow(
      /Add counter\(\) to this form's plugins: plugin "autosave" requires it/,
    );
  });

  it("orders a plugin after what it requires, and gives it their APIs", () => {
    const order: string[] = [];
    let count: unknown;
    const autosave = definePlugin({
      name: "autosave",
      requires: () => [counter],
      setup(ctx) {
        order.push("autosave");
        count = ctx.plugins.counter.count;
        return {};
      },
    });
    const first = definePlugin({ name: "counter", setup: () => (order.push("counter"), { api: { count: 2 } }) });
    // `first` stands in for counter(), which the types can't see.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    createFormsCore({ plugins: [arrays(), autosave, first] as never }).define({ defaultValues: {} }).createStore();
    expect(order).toEqual(["counter", "autosave"]);
    expect(count).toBe(2);
  });

  it("lists the installed plugins in hook order and the attachments at or above a path", () => {
    let names: string[] = [];
    let at: ((path: Path) => readonly Attachment[]) | undefined;
    const watcher = definePlugin({
      name: "watcher",
      after: ["tag"],
      setup(ctx) {
        names = ctx.installed.map((plugin) => plugin.name);
        at = ctx.attachments;
        return {};
      },
    });
    const { store } = testStore({ defaultValues: { a: { b: "" } }, plugins: [watcher, tagger()] }, tag("!", "a"));
    expect(names.slice(0, 2)).toEqual(["tag", "watcher"]);
    expect(at?.(["a", "b"])).toEqual([{ name: "tag", path: ["a"] }]);
    expect(at?.([])).toEqual([]);
    void store;
  });
});
