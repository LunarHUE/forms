import type { FieldSnapshot, FormSnapshot, PluginContext } from "@lunarhue/forms-core";
import { definePlugin, pluginApi } from "@lunarhue/forms-core/plugins";
import { describe, expectTypeOf, it } from "vitest";
import { createFormsCore } from "../index.js";

// Augmented through the package name, as a plugin package would write it.
declare module "@lunarhue/forms-core" {
  interface FieldMeta {
    readonly upload: { readonly progress: number };
  }
  interface FormMeta {
    readonly upload: { readonly pending: number };
  }
}

describe("plugin types", () => {
  it("shows an augmented slot on the snapshots", () => {
    expectTypeOf<NonNullable<FieldSnapshot<string>["meta"]>["upload"]>().toEqualTypeOf<{ readonly progress: number } | undefined>();
    expectTypeOf<NonNullable<FormSnapshot["meta"]>["upload"]>().toEqualTypeOf<{ readonly pending: number } | undefined>();
  });

  it("types setMeta and setFormMeta from the plugin's name", () => {
    expectTypeOf<PluginContext<"upload">["setMeta"]>().parameter(1).toEqualTypeOf<{ readonly progress: number }>();
    expectTypeOf<PluginContext<"upload">["setFormMeta"]>().parameter(0).toEqualTypeOf<{ readonly pending: number }>();
    // A name without a declared slot takes any value.
    expectTypeOf<PluginContext<"free">["setMeta"]>().parameter(1).toBeUnknown();
    definePlugin({
      name: "upload",
      setup(ctx) {
        ctx.setMeta(["file"], { progress: 1 });
        // @ts-expect-error The slot holds `{ progress }`.
        ctx.setMeta(["file"], { done: true });
        ctx.setFormMeta({ pending: 0 });
        // @ts-expect-error The form slot holds `{ pending }`.
        ctx.setFormMeta({ progress: 1 });
        return {};
      },
    });
  });

  it("types pluginApi from the plugin", () => {
    const counter = definePlugin({ name: "counter", setup: () => ({ api: { count: 1 } }) });
    const store = createFormsCore().define({ defaultValues: { name: "" }, plugins: [counter] }).createStore();
    expectTypeOf(pluginApi(store, counter)).toEqualTypeOf<{ count: number } | undefined>();
  });
});
