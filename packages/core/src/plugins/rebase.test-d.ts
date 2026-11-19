import type { AnyFieldHandle, FormStore, HookPlugin, ObjectHandle } from "@lunarhue/forms-core";
import { type Rebase, rebase, type RebaseLeaf, type RebaseResult } from "@lunarhue/forms-core/plugins/rebase";
import { describe, expectTypeOf, it } from "vitest";
import { createFormsCore } from "../index.js";

declare const api: Rebase;
declare const store: FormStore<{ name: string; tags: string[] }, { code: number }>;
declare const any: AnyFieldHandle;

describe("rebase", () => {
  it("takes the incoming value of the handle's value type, for any error type", () => {
    expectTypeOf(store.root).toEqualTypeOf<ObjectHandle<{ name: string; tags: string[] }, { code: number }>>();
    expectTypeOf(api(store.root, { name: "a", tags: [] }, () => "keep")).toEqualTypeOf<RebaseResult>();
    api(store.root.at("tags"), ["a"], () => "take");
    api(any, 1, () => "keep");
    api(store.root, store.root.peek().value, () => "keep");
    api(store.root.at("tags"), store.root.at("tags").peek().value, () => "take");
    // @ts-expect-error: name is a string
    api(store.root, { name: 1, tags: [] }, () => "keep");
    // @ts-expect-error: tags is a list
    api(store.root.at("tags"), "a", () => "keep");
  });

  it("is a plugin whose API is on store.plugins.rebase", () => {
    expectTypeOf(rebase()).toEqualTypeOf<HookPlugin<Rebase, "rebase">>();
    const forms = createFormsCore({ plugins: [rebase()] });
    const order = forms.define({ defaultValues: { name: "", qty: 1 } }).createStore();
    expectTypeOf(order.plugins).toEqualTypeOf<{ readonly rebase: Rebase }>();
    order.plugins.rebase(order.root, { name: "a", qty: 2 }, (leaf) => {
      expectTypeOf(leaf).toEqualTypeOf<RebaseLeaf>();
      return leaf.edited ? "keep" : "take";
    });
    order.plugins.rebase(order.root.at("qty"), 3, () => "take");
    // @ts-expect-error: qty is a number
    order.plugins.rebase(order.root, { name: "a", qty: "2" }, () => "take");
  });

  it("is missing from store.plugins when it isn't installed", () => {
    const order = createFormsCore().define({ defaultValues: { name: "" } }).createStore();
    expectTypeOf(order.plugins).not.toHaveProperty("rebase");
    // @ts-expect-error: no rebase plugin
    void order.plugins.rebase;
  });
});
