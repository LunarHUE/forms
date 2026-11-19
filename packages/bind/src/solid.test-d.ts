import { createFormsCore } from "@lunarhue/forms-core";
import type { BindPlugin } from "@lunarhue/forms-core/plugins";
import { createSignal } from "solid-js";
import { describe, expectTypeOf, it } from "vitest";
import { signal } from "./solid.js";

interface Profile {
  name: string;
  email: string;
}

const profile = createFormsCore().define({ defaultValues: { name: "", email: "" } });
const [settings, setSettings] = createSignal<Profile>({ name: "", email: "" });
const [count, setCount] = createSignal(0);

describe("signal types", () => {
  it("names the signal's type, and needs the getter and setter to share it", () => {
    expectTypeOf(signal(settings, setSettings)).toEqualTypeOf<BindPlugin<Profile>>();
    expectTypeOf(signal(count, setCount, { initial: "form" })).toEqualTypeOf<BindPlugin<number>>();
    // @ts-expect-error The setter takes a number, not a `Profile`.
    signal(settings, setCount);
  });

  it("needs the form value type to be the signal's type, on an instance", () => {
    expectTypeOf(profile.createStore(undefined, { plugins: [signal(settings, setSettings)] }).id).toBeString();
    // @ts-expect-error A number isn't a `Profile`.
    profile.createStore(undefined, { plugins: [signal(count, setCount)] });
  });
});
