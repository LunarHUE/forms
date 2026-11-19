import type { FieldSnapshot, HookPlugin, PluginContext } from "@lunarhue/forms-core";
import { definePlugin } from "@lunarhue/forms-core/plugins";
import { history, type HistoryMeta } from "@lunarhue/forms-core/plugins/history";
import { describe, expectTypeOf, it } from "vitest";
import { createFormsCore } from "../index.js";

interface UploadMeta {
  readonly progress: number;
}
interface UploadFormMeta {
  readonly pending: number;
}

const upload = definePlugin({
  name: "upload",
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

const required = (value: string) => (value ? undefined : { message: "Required" });

describe("plugin types", () => {
  it("types the meta readers from setup's context", () => {
    expectTypeOf(upload).toEqualTypeOf<HookPlugin<undefined, "upload", UploadMeta, UploadFormMeta>>();
    const store = createFormsCore().define({ defaultValues: { file: "" }, plugins: [upload] }).createStore();
    expectTypeOf(upload.meta(store.getSnapshot(["file"]))).toEqualTypeOf<UploadMeta | undefined>();
    expectTypeOf(upload.formMeta(store.getFormSnapshot())).toEqualTypeOf<UploadFormMeta | undefined>();
    // The snapshots keep meta untyped, so no plugin needs a global declaration.
    expectTypeOf<FieldSnapshot<string>["meta"]>().toEqualTypeOf<Readonly<Record<string, unknown>> | undefined>();
  });

  it("drops undefined from formMeta when the definition gives initialFormMeta", () => {
    const queue = definePlugin({
      name: "queue",
      initialFormMeta: { pending: 0 },
      setup(ctx: PluginContext<UploadMeta, UploadFormMeta>) {
        ctx.setFormMeta({ pending: 1 });
        return {};
      },
    });
    expectTypeOf(queue.formMeta({})).toEqualTypeOf<UploadFormMeta>();
    // Field meta has no starting value, so it can still be undefined.
    expectTypeOf(queue.meta({})).toEqualTypeOf<UploadMeta | undefined>();
    expectTypeOf(queue).toEqualTypeOf<HookPlugin<undefined, "queue", UploadMeta, UploadFormMeta, undefined, never>>();
    expectTypeOf(history().formMeta({})).toEqualTypeOf<HistoryMeta>();
    definePlugin({
      name: "wrong",
      // @ts-expect-error The form slot holds `{ pending }`.
      initialFormMeta: { progress: 0 },
      setup: (_ctx: PluginContext<UploadMeta, UploadFormMeta>) => ({}),
    });
  });

  it("drops undefined from meta when the definition gives initialMeta", () => {
    const progress = definePlugin({
      name: "progress",
      initialMeta: { progress: 0 },
      setup(ctx: PluginContext<UploadMeta, UploadFormMeta>) {
        ctx.setMeta(["file"], { progress: 1 });
        return {};
      },
    });
    expectTypeOf(progress.meta({})).toEqualTypeOf<UploadMeta>();
    expectTypeOf(progress.formMeta({})).toEqualTypeOf<UploadFormMeta | undefined>();
    const both = definePlugin({
      name: "both",
      initialMeta: { progress: 0 },
      initialFormMeta: { pending: 0 },
      setup: (_ctx: PluginContext<UploadMeta, UploadFormMeta>) => ({}),
    });
    expectTypeOf(both).toEqualTypeOf<HookPlugin<undefined, "both", UploadMeta, UploadFormMeta, never, never>>();
    definePlugin({
      name: "wrong",
      // @ts-expect-error The field slot holds `{ progress }`.
      initialMeta: { pending: 0 },
      setup: (_ctx: PluginContext<UploadMeta, UploadFormMeta>) => ({}),
    });
  });

  it("leaves meta unknown when setup's context isn't annotated", () => {
    const free = definePlugin({
      name: "free",
      setup(ctx) {
        ctx.setMeta(["a"], 1);
        ctx.setMeta(["a"], "anything");
        return {};
      },
    });
    expectTypeOf(free.meta({})).toBeUnknown();
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
    });
    expectTypeOf(writer.name).toEqualTypeOf<"writer">();
  });

  it("takes initial on a plugin definition", () => {
    const start = definePlugin({ name: "start", initial: () => ({ name: "a" }), setup: () => ({}) });
    expectTypeOf<(typeof start)["initial"]>().toEqualTypeOf<((value: unknown) => unknown) | undefined>();
  });

  it("puts each API on store.plugins, typed and not optional", () => {
    const counter = definePlugin({ name: "counter", setup: () => ({ api: { count: 1 } }) });
    const shared = createFormsCore({ plugins: [counter] });
    const store = shared.define({ defaultValues: { name: "" }, plugins: [upload] }).createStore();
    expectTypeOf(store.plugins).toEqualTypeOf<{ readonly counter: { count: number } }>();
    expectTypeOf(store.plugins.counter.count).toEqualTypeOf<number>();
    // @ts-expect-error upload has no API
    void store.plugins.upload;
  });

  it("adds the definition's own plugin APIs to the shared ones", () => {
    const counter = definePlugin({ name: "counter", setup: () => ({ api: { count: 1 } }) });
    const clock = definePlugin({ name: "clock", setup: () => ({ api: { now: (): number => 0 } }) });
    const store = createFormsCore({ plugins: [counter] })
      .define({ defaultValues: { name: "" }, plugins: [clock] })
      .createStore();
    expectTypeOf(store.plugins.clock.now).toEqualTypeOf<() => number>();
    expectTypeOf(store.plugins.counter.count).toEqualTypeOf<number>();
  });

  it("takes validate whatever plugins are installed", () => {
    createFormsCore().define({ defaultValues: { name: "" }, validate: { fields: { name: required } } });
    createFormsCore().define({ defaultValues: { name: "" }, plugins: [upload], validate: { fields: { name: required } } });
    expectTypeOf(required).toBeFunction();
  });
});
