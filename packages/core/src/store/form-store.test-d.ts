import { describe, expectTypeOf, it } from "vitest";
import type { FormError } from "../errors.js";
import type { AnyFieldHandle, NamedAnyFieldHandle, NamedArrayHandle, NamedLeafHandle, NamedObjectHandle } from "../handle.js";
import type { DisabledInvalid, FormStore } from "../store.js";
import { branch } from "./branch.js";
import { createFormStore } from "./form-store.js";
import type { AnyItemHandle, Handles } from "./handles.js";

type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };

interface Profile {
  name: string;
  shape: Shape;
  rows: { title: string }[];
}

declare const initial: Profile;

describe("createFormStore", () => {
  it("types the store and its root handle from V", () => {
    const store = createFormStore<Profile>({ id: "f", initial });
    expectTypeOf(store).toEqualTypeOf<FormStore<Profile, FormError, undefined, unknown, {}, "dirty" | "arrays">>();
    expectTypeOf(store.root).toEqualTypeOf<NamedObjectHandle<Profile, FormError, "dirty" | "arrays">>();
    expectTypeOf(store.root.at("rows")).toEqualTypeOf<NamedArrayHandle<{ title: string }[], FormError, "dirty" | "arrays">>();
    expectTypeOf(store.root.at("name")).toEqualTypeOf<NamedLeafHandle<string, FormError, "dirty" | "arrays">>();
  });

  it("infers V from the initial value and checks flags against it", () => {
    const store = createFormStore({ id: "f", initial: { tags: ["a"] }, disabled: { tags: [true] } });
    expectTypeOf(store.root).toEqualTypeOf<NamedObjectHandle<{ tags: string[] }, FormError, "dirty" | "arrays">>();
    // @ts-expect-error: the value has no key "nope"
    createFormStore({ id: "f", initial: { tags: ["a"] }, disabled: { nope: true } });
  });

  it("types disabledInvalid with the form's error type", () => {
    const store = createFormStore<Profile, string>({ id: "f", initial });
    expectTypeOf(store.disabledInvalid()).toEqualTypeOf<readonly DisabledInvalid<string>[]>();
    expectTypeOf<DisabledInvalid<string>>().toEqualTypeOf<{
      readonly field: NamedAnyFieldHandle<string>;
      readonly name: string;
      readonly errors: readonly string[];
    }>();
    expectTypeOf<DisabledInvalid["errors"]>().toEqualTypeOf<readonly FormError[]>();
    const list = store.disabledInvalid();
    // @ts-expect-error: the list is read-only
    list.push(...list);
  });

  it("makes runtime handles that are AnyFieldHandle", () => {
    expectTypeOf<ReturnType<Handles<FormError>["root"]>>().toEqualTypeOf<NamedAnyFieldHandle<FormError, "dirty" | "arrays">>();
    expectTypeOf<AnyItemHandle<FormError>>().toExtend<AnyFieldHandle>();
    expectTypeOf<NamedObjectHandle<Profile>>().toExtend<Pick<AnyFieldHandle, "id" | "path" | "peek">>();
  });
});

describe("branch", () => {
  it("narrows an object handle over a union", () => {
    const shape = createFormStore<Profile>({ id: "f", initial }).root.at("shape");
    const circle = branch(shape, shape.peek(), "kind", "circle");
    expectTypeOf(circle).toEqualTypeOf<NamedObjectHandle<{ kind: "circle"; radius: number }, FormError, "dirty" | "arrays"> | undefined>();
    expectTypeOf(circle?.at("radius")).toEqualTypeOf<NamedLeafHandle<number, FormError, "dirty" | "arrays"> | undefined>();
    // @ts-expect-error: "triangle" is not a kind
    branch(shape, shape.peek(), "kind", "triangle");
  });
});
