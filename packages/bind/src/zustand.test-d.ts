import { createFormsCore } from "@lunarhue/forms-core";
import type { BindPlugin } from "@lunarhue/forms-core/plugins/bind";
import { describe, expectTypeOf, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { zustand } from "./zustand.js";

interface Profile {
  name: string;
  email: string;
}
interface App {
  profile: Profile;
  count: number;
}

const profile = createFormsCore().define({ defaultValues: { name: "", email: "" } });
const whole = createStore<Profile>()(() => ({ name: "", email: "" }));
const app = createStore<App>()(() => ({ profile: { name: "", email: "" }, count: 0 }));

describe("zustand types", () => {
  it("names the store's state, or the slice's type", () => {
    expectTypeOf(zustand(whole)).toEqualTypeOf<BindPlugin<Profile>>();
    expectTypeOf(zustand(app, { select: (state) => state.profile, update: (value) => ({ profile: value }) })).toEqualTypeOf<
      BindPlugin<Profile>
    >();
  });

  it("needs update to give back part of the state", () => {
    expectTypeOf(zustand(app, { select: (state) => state.count, update: (count) => ({ count }) })).toEqualTypeOf<BindPlugin<number>>();
    // @ts-expect-error `update` must return part of `App`.
    zustand(app, { select: (state) => state.profile, update: (value) => ({ user: value }) });
    // @ts-expect-error `update` takes what `select` returns.
    zustand(app, { select: (state) => state.count, update: (value: string) => ({ count: Number(value) }) });
  });

  it("needs the form value type to be the bound type, on an instance", () => {
    expectTypeOf(profile.createStore(undefined, { plugins: [zustand(whole)] }).id).toBeString();
    profile.createStore(undefined, {
      plugins: [zustand(app, { select: (state) => state.profile, update: (value) => ({ profile: value }) })],
    });
    // @ts-expect-error The whole `App` state isn't a `Profile`.
    profile.createStore(undefined, { plugins: [zustand(app)] });
    // @ts-expect-error The `count` slice isn't a `Profile`.
    profile.createStore(undefined, { plugins: [zustand(app, { select: (state) => state.count, update: (count) => ({ count }) })] });
  });
});
