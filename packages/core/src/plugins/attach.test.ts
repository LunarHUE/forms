import { describe, expect, it } from "vitest";
import { attach } from "../attach.js";
import { createFormsCore } from "../index.js";
import type { AttachedPart, Part, Path } from "../index.js";
import { definePlugin, refuse } from "../plugins.js";
import { dirty } from "./dirty.js";
import { testStore } from "./testing.js";
import { arrays } from "./arrays.js";
import { part } from "./part.js";

type Seen = { path: Path; config: unknown }[];

/** A plugin whose parts record where they attached, and add their suffix to each write. */
const tagger = definePlugin({
  name: "tag",
  part(ctx, { suffix, seen }: { readonly suffix: string; readonly seen?: Seen }) {
    seen?.push({ path: ctx.path, config: suffix });
    return { beforeWrite: (write) => (typeof write.value === "string" && write.cause !== "attach" ? `${write.value}${suffix}` : write.value) };
  },
});
const tag = (suffix: string, path?: string, seen?: Seen): Part<typeof tagger, unknown> => ({ ...part(tagger, { suffix, ...(seen && { seen }) }), ...(path && { path }) });

describe("attach", () => {
  it("runs attach once per path, with the context's path", () => {
    const seen: { path: Path; config: unknown }[] = [];
    const { store, errors } = testStore({ defaultValues: { a: { b: "" } }, plugins: [arrays(), tagger()] }, tag("!", "a.b", seen));
    expect(seen).toEqual([{ path: ["a", "b"], config: "!" }]);
    store.root.at("a").at("b").setValue("x");
    expect(store.getSnapshot(["a", "b"]).value).toBe("x!");
    expect(errors).toEqual([]);
  });

  it("attaches a pinned copy of a part once with the part", () => {
    const seen: { path: Path; config: unknown }[] = [];
    const tagged = tag("!", undefined, seen);
    const pinned: Part<typeof tagger, unknown> = { ...tagged, path: "a", "~of": tagged };
    const { store } = testStore({ defaultValues: { a: "" }, plugins: [arrays(), tagger()] }, pinned);
    attach(store.root.at("a"), [tagged]);
    expect(seen).toEqual([{ path: ["a"], config: "!" }]);
  });

  it("runs beforeWrite once on the value there when the part attaches, with no record, and keeps the field clean", () => {
    const causes: unknown[] = [];
    const trims = definePlugin({
      name: "trim",
      part: (_ctx, _config: void) => ({
        beforeWrite: (write) => {
          causes.push(write.cause);
          return typeof write.value === "string" ? write.value.trim() : write.value;
        },
      }),
    });
    const { store, records, errors } = testStore({ defaultValues: { a: " x " }, plugins: [arrays(), dirty(), trims()] }, { ...part(trims), path: "a" });
    expect(store.getSnapshot(["a"])).toMatchObject({ value: "x", dirty: false });
    expect(causes).toEqual(["attach"]);
    expect(records.sync).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("gives a part the value at its path and the fields below it", () => {
    const seen: unknown[] = [];
    const lock = definePlugin({
      name: "lock",
      part: (ctx, _config: void) => ({
        onWrite: () => {
          seen.push(ctx.value());
          ctx.write(() => ctx.at("b").setDisabled(true));
        },
      }),
    });
    const { store, errors } = testStore({ defaultValues: { a: { b: "", c: "" } }, plugins: [arrays(), lock()] }, { ...part(lock), path: "a" });
    store.root.at("a").at("c").setValue("x");
    expect(seen[0]).toEqual({ b: "", c: "x" });
    expect(store.getSnapshot(["a", "b"]).disabled).toBe(true);
    expect(errors).toEqual([]);
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
      part: (_ctx, _config: { readonly suffix: string }) => ({ beforeWrite: (write) => (write.value === "no" ? refuse : write.value) }),
    })();
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

const counter = () => definePlugin({ name: "counter", setup: () => ({ api: { count: 1 } }) })();

describe("requires", () => {
  it("throws plugins:missing when a required plugin isn't there", () => {
    const autosave = definePlugin({ name: "autosave", requires: () => [counter], setup: () => ({}) })();
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
    })();
    const first = definePlugin({ name: "counter", setup: () => (order.push("counter"), { api: { count: 2 } }) })();
    // `first` stands in for counter(), which the types can't see.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    createFormsCore({ plugins: [arrays(), autosave, first] as never }).define({ defaultValues: {} }).createStore();
    expect(order).toEqual(["counter", "autosave"]);
    expect(count).toBe(2);
  });

  it("lists the installed plugins in hook order and the parts at or above a path", () => {
    let names: string[] = [];
    let at: ((path: Path) => readonly AttachedPart[]) | undefined;
    const watcher = definePlugin({
      name: "watcher",
      requires: () => [tagger],
      setup(ctx) {
        names = ctx.installed.map((plugin) => plugin.name);
        at = ctx.parts;
        return {};
      },
    })();
    const { store } = testStore({ defaultValues: { a: { b: "" } }, plugins: [watcher, tagger()] }, tag("!", "a"));
    expect(names.slice(0, 2)).toEqual(["tag", "watcher"]);
    expect(at?.(["a", "b"])).toEqual([{ name: "tag", path: ["a"] }]);
    expect(at?.([])).toEqual([]);
    void store;
  });
});
