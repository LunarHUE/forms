import { describe, expectTypeOf, it } from "vitest";
import type { AnyFieldHandle, FormStore, ObjectHandle } from "./index.js";
import type { Rebase, RebaseResult } from "./rebase.js";

declare const rebase: Rebase;
declare const store: FormStore<{ name: string; tags: string[] }, { code: number }>;
declare const any: AnyFieldHandle;

describe("rebase", () => {
  it("takes the incoming value of the handle's value type, for any error type", () => {
    expectTypeOf(store.root).toEqualTypeOf<ObjectHandle<{ name: string; tags: string[] }, { code: number }>>();
    expectTypeOf(rebase(store.root, { name: "a", tags: [] }, () => "keep")).toEqualTypeOf<RebaseResult>();
    rebase(store.root.at("tags"), ["a"], () => "take");
    rebase(any, 1, () => "keep");
    // @ts-expect-error: name is a string
    rebase(store.root, { name: 1, tags: [] }, () => "keep");
    // @ts-expect-error: tags is a list
    rebase(store.root.at("tags"), "a", () => "keep");
  });
});
