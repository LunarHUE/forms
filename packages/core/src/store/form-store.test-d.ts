import { describe, expectTypeOf, it } from "vitest";
import type { FormError } from "../errors.js";
import type { AnyFieldHandle, ArrayHandle, LeafHandle, ObjectHandle } from "../handle.js";
import type { FormStore } from "../store.js";
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
    expectTypeOf(store).toEqualTypeOf<FormStore<Profile>>();
    expectTypeOf(store.root).toEqualTypeOf<ObjectHandle<Profile>>();
    expectTypeOf(store.root.at("rows")).toEqualTypeOf<ArrayHandle<{ title: string }[]>>();
    expectTypeOf(store.root.at("name")).toEqualTypeOf<LeafHandle<string>>();
  });

  it("infers V from the initial value and checks flags against it", () => {
    const store = createFormStore({ id: "f", initial: { tags: ["a"] }, disabled: { tags: [true] } });
    expectTypeOf(store.root).toEqualTypeOf<ObjectHandle<{ tags: string[] }>>();
    // @ts-expect-error: the value has no key "nope"
    createFormStore({ id: "f", initial: { tags: ["a"] }, disabled: { nope: true } });
  });

  it("makes runtime handles that are AnyFieldHandle", () => {
    expectTypeOf<ReturnType<Handles<FormError>["root"]>>().toEqualTypeOf<AnyFieldHandle>();
    expectTypeOf<AnyItemHandle<FormError>>().toExtend<AnyFieldHandle>();
    expectTypeOf<ObjectHandle<Profile>>().toExtend<Pick<AnyFieldHandle, "id" | "path" | "peek">>();
  });
});

describe("branch", () => {
  it("narrows an object handle over a union", () => {
    const shape = createFormStore<Profile>({ id: "f", initial }).root.at("shape");
    const circle = branch(shape, shape.peek(), "kind", "circle");
    expectTypeOf(circle).toEqualTypeOf<ObjectHandle<{ kind: "circle"; radius: number }> | undefined>();
    expectTypeOf(circle?.at("radius")).toEqualTypeOf<LeafHandle<number> | undefined>();
    // @ts-expect-error: "triangle" is not a kind
    branch(shape, shape.peek(), "kind", "triangle");
  });
});
