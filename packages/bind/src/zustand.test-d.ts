import { createFormsCore } from "@lunarhue/forms-core";
import type { BindPlugin } from "@lunarhue/forms-core/plugins";
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

  it("hands update the state, and takes a one-argument update", () => {
    zustand(app, {
      select: (state) => state.profile,
      update: (value, state) => {
        expectTypeOf(value).toEqualTypeOf<Profile>();
        expectTypeOf(state).toEqualTypeOf<App>();
        return { profile: value, count: state.count + 1 };
      },
    });
    const update = (value: Profile) => ({ profile: value });
    expectTypeOf(zustand(app, { select: (state) => state.profile, update })).toEqualTypeOf<BindPlugin<Profile>>();
  });

  it("types isEqual with the slice", () => {
    expectTypeOf(
      zustand(app, {
        select: (state) => ({ name: state.profile.name, count: state.count }),
        update: (value) => ({ count: value.count }),
        isEqual: (previous, next) => {
          expectTypeOf(previous).toEqualTypeOf<{ name: string; count: number }>();
          return previous.name === next.name && previous.count === next.count;
        },
      }),
    ).toEqualTypeOf<BindPlugin<{ name: string; count: number }>>();
    // @ts-expect-error `isEqual` takes slices, not strings.
    zustand(app, { select: (state) => state.count, update: (count) => ({ count }), isEqual: (a: string, b: string) => a === b });
    // @ts-expect-error The whole state has no `isEqual`.
    zustand(app, { isEqual: Object.is });
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
