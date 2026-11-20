import { createFormsCore, type Plugin, type PluginNames } from "@lunarhue/forms-core";
import { describe, expectTypeOf, it } from "vitest";
import { devtools, type DevtoolsOptions, syncDevtools } from "./index.js";

describe("devtools", () => {
  it("is a plugin named devtools with no API", () => {
    expectTypeOf(devtools()).toEqualTypeOf<Plugin<undefined, "devtools">>();
    expectTypeOf(syncDevtools).toEqualTypeOf<() => void>();
  });

  it("takes enabled as a boolean or a function, and onDisable", () => {
    devtools();
    devtools({ enabled: false, onDisable: () => {} });
    devtools({ enabled: () => location.search.includes("devtools") });
    // @ts-expect-error: enabled is a boolean or a function
    devtools({ enabled: "yes" });
    // @ts-expect-error: no name option
    devtools({ name: "panel" });
    expectTypeOf<keyof DevtoolsOptions>().toEqualTypeOf<"enabled" | "onDisable">();
  });

  it("counts dev && devtools() as not installed", () => {
    const dev = Math.random() > 0.5;
    expectTypeOf<PluginNames<[false | ReturnType<typeof devtools>]>>().toEqualTypeOf<never>();
    expectTypeOf<PluginNames<[ReturnType<typeof devtools>]>>().toEqualTypeOf<"devtools">();
    const store = createFormsCore({ plugins: [dev && devtools()] }).define({ defaultValues: { name: "" } }).createStore();
    expectTypeOf(store.plugins).toEqualTypeOf<{}>();
  });
});
