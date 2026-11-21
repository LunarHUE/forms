import type { FieldSnapshot, Part, Path, Plugin, PluginContext } from "@lunarhue/forms-core";
import { definePlugin, dirty, history, type HistoryMeta } from "@lunarhue/forms-core/plugins";
import { describe, expectTypeOf, it } from "vitest";
import { createFormsCore, fieldValidators } from "../index.js";

interface UploadMeta {
  readonly progress: number;
}
interface UploadFormMeta {
  readonly pending: number;
}

const uploads = definePlugin({
  name: "upload",
  initialMeta: { progress: 0 },
  initialFormMeta: { pending: 0 },
  setup(ctx: PluginContext<UploadMeta, UploadFormMeta>) {
    ctx.setMeta(["file"], { progress: 1 });
    // @ts-expect-error The field slot holds `{ progress }`.
    ctx.setMeta(["file"], { done: true });
    ctx.setFormMeta({ pending: 0 });
    // @ts-expect-error The form slot holds `{ pending }`.
    ctx.setFormMeta({ progress: 1 });
    return {};
  },
});
const upload = uploads();

const required = (value: string) => (value ? undefined : { message: "Required" });

const tagged = (prefix: string): Part<"tag", string> => ({ plugin: "tag", config: { prefix } });
const counting = () => definePlugin({ name: "counter", setup: () => ({ api: { count: 1 } }) })();

describe("plugin types", () => {
  it("types the meta readers on the factory from the context and the starting values", () => {
    expectTypeOf(upload).toEqualTypeOf<Plugin<undefined, "upload", UploadMeta, UploadFormMeta>>();
    const store = createFormsCore().define({ defaultValues: { file: "" }, plugins: [upload] }).createStore();
    expectTypeOf(uploads.meta(store.getSnapshot(["file"]))).toEqualTypeOf<UploadMeta>();
    expectTypeOf(uploads.formMeta(store.getFormSnapshot())).toEqualTypeOf<UploadFormMeta>();
    expectTypeOf(history.formMeta({})).toEqualTypeOf<HistoryMeta>();
    // The snapshots keep meta untyped, so no plugin needs a global declaration.
    expectTypeOf<FieldSnapshot<string>["meta"]>().toEqualTypeOf<Readonly<Record<string, unknown>> | undefined>();
  });

  it("needs a starting value for each meta slot the plugin keeps", () => {
    // @ts-expect-error initialMeta is missing.
    definePlugin({
      name: "field",
      setup: (_ctx: PluginContext<UploadMeta>) => ({}),
    });
    // @ts-expect-error initialFormMeta is missing.
    definePlugin({
      name: "form",
      initialMeta: { progress: 0 },
      setup: (_ctx: PluginContext<UploadMeta, UploadFormMeta>) => ({}),
    });
    definePlugin({
      name: "wrong",
      // @ts-expect-error The field slot holds `{ progress }`.
      initialMeta: { pending: 0 },
      initialFormMeta: { pending: 0 },
      setup: (_ctx: PluginContext<UploadMeta, UploadFormMeta>) => ({}),
    });
    const counter = definePlugin({ name: "counter", initialMeta: 0, setup: (ctx) => ({ api: { set: (n: number) => ctx.setMeta(["a"], n) } }) });
    expectTypeOf(counter.meta({})).toEqualTypeOf<number>();
  });

  it("gives a plugin with no starting value no meta readers", () => {
    const free = definePlugin({
      name: "free",
      setup(ctx) {
        // @ts-expect-error The plugin keeps no meta.
        ctx.setMeta(["a"], 1);
        return {};
      },
    });
    expectTypeOf(free).not.toHaveProperty("meta");
    expectTypeOf(free).not.toHaveProperty("formMeta");
  });

  it('lets ctx.write claim "rebase" and no other cause', () => {
    const writer = definePlugin({
      name: "writer",
      setup(ctx) {
        ctx.write(() => {});
        ctx.write(() => {}, "rebase");
        // @ts-expect-error A plugin can't claim a user edit.
        ctx.write(() => {}, "user");
        // @ts-expect-error A plugin can't claim a reset.
        ctx.write(() => {}, "reset");
        // @ts-expect-error Its own cause is the default, not something it passes.
        ctx.write(() => {}, { plugin: "writer" });
        return {};
      },
    })();
    expectTypeOf(writer.name).toEqualTypeOf<"writer">();
  });

  it("types ctx.plugins and ctx.store from requires, and checks the list has them", () => {
    const autosave = definePlugin({
      name: "autosave",
      requires: () => [counting, dirty],
      setup(ctx) {
        expectTypeOf(ctx.plugins.counter.count).toEqualTypeOf<number>();
        expectTypeOf(ctx.store.changes).toBeFunction();
        // @ts-expect-error history isn't required
        void ctx.plugins.history;
        return {};
      },
    })();
    createFormsCore({ plugins: [counting(), dirty(), autosave] });
    // @ts-expect-error counting() is missing
    createFormsCore({ plugins: [dirty(), autosave] });
    // A definition's plugins count the shared ones.
    createFormsCore({ plugins: [counting(), dirty()] }).define({ defaultValues: { a: "" }, plugins: [autosave] });
    // @ts-expect-error counting() is missing
    createFormsCore({ plugins: [dirty()] }).define({ defaultValues: { a: "" }, plugins: [autosave] });
    expectTypeOf(autosave.name).toEqualTypeOf<"autosave">();
  });

  it("passes the factory's options to setup and initialValue", () => {
    const start = definePlugin({
      name: "start",
      initialValue: (_value, name: string) => ({ name }),
      setup: (_ctx, name: string) => ({ api: { name } }),
    });
    expectTypeOf(start("a").name).toEqualTypeOf<"start">();
    // @ts-expect-error The options are required when setup takes them.
    start();
    const plain = definePlugin({ name: "plain", setup: () => ({}) });
    plain();
    // @ts-expect-error setup takes no options.
    plain(1);
  });

  it("types part's config from its parameter, and parts need their plugin", () => {
    const tags = definePlugin({
      name: "tag",
      part(ctx, config: { readonly prefix: string }) {
        expectTypeOf(ctx.path).toEqualTypeOf<Path>();
        expectTypeOf(ctx.value()).toEqualTypeOf<unknown>();
        return { display: (value) => `${config.prefix}${String(value)}`, afterInput: (input) => input.setSelectionRange(0, 0) };
      },
    });
    const tag = tags();
    expectTypeOf(tag.name).toEqualTypeOf<"tag">();
    // @ts-expect-error The config needs a prefix.
    tags.part({});
    const pinned: Part<"tag", { readonly a: string }> = { ...tags.part<{ readonly a: string }>({ prefix: "#" }), path: "a" };
    createFormsCore({ plugins: [tag] }).define({ defaultValues: { a: "" } }, pinned);
    // @ts-expect-error the form has no tag()
    createFormsCore().define({ defaultValues: { a: "" } }, pinned);
    // @ts-expect-error a part for string values doesn't fit the root object
    createFormsCore({ plugins: [tag] }).define({ defaultValues: { a: "" } }, tagged("#"));
  });

  it("puts each API on store.plugins, typed and not optional", () => {
    const counter = definePlugin({ name: "counter", setup: () => ({ api: { count: 1 } }) })();
    const shared = createFormsCore({ plugins: [counter] });
    const store = shared.define({ defaultValues: { name: "" }, plugins: [upload] }).createStore();
    expectTypeOf(store.plugins).toEqualTypeOf<{ readonly counter: { count: number } }>();
    expectTypeOf(store.plugins.counter.count).toEqualTypeOf<number>();
    // @ts-expect-error upload has no API
    void store.plugins.upload;
  });

  it("adds the definition's own plugin APIs to the shared ones", () => {
    const counter = definePlugin({ name: "counter", setup: () => ({ api: { count: 1 } }) })();
    const clock = definePlugin({ name: "clock", setup: () => ({ api: { now: (): number => 0 } }) })();
    const store = createFormsCore({ plugins: [counter] })
      .define({ defaultValues: { name: "" }, plugins: [clock] })
      .createStore();
    expectTypeOf(store.plugins.clock.now).toEqualTypeOf<() => number>();
    expectTypeOf(store.plugins.counter.count).toEqualTypeOf<number>();
  });

  it("takes validate whatever plugins are installed", () => {
    createFormsCore().define({ defaultValues: { name: "" }, validate: { fields: fieldValidators({ name: required }) } });
    createFormsCore().define({ defaultValues: { name: "" }, plugins: [upload], validate: { fields: fieldValidators({ name: required }) } });
    expectTypeOf(required).toBeFunction();
  });
});
