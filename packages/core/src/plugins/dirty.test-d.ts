import type { Change, FieldSnapshot, FormError, FormSnapshot, FormStore } from "@lunarhue/forms-core";
import { dirty, history } from "@lunarhue/forms-core/plugins";
import { describe, expectTypeOf, it } from "vitest";
import { createFormsCore } from "../index.js";

const value = { name: "", tags: [""] };
const bare = createFormsCore().define({ defaultValues: value }).createStore();
const tracked = createFormsCore({ plugins: [dirty()] }).define({ defaultValues: value }).createStore();
const local = createFormsCore().define({ defaultValues: value, plugins: [history(), dirty()] }).createStore();

describe("dirty members", () => {
  it("are on the form snapshot only with dirty()", () => {
    expectTypeOf(tracked.getFormSnapshot().dirty).toEqualTypeOf<boolean>();
    expectTypeOf(local.getFormSnapshot().dirty).toEqualTypeOf<boolean>();
    // @ts-expect-error: the form has no dirty()
    void bare.getFormSnapshot().dirty;
  });

  it("are on field snapshots only with dirty()", () => {
    expectTypeOf(tracked.root.at("name").peek().dirty).toEqualTypeOf<boolean>();
    expectTypeOf(tracked.getSnapshot(["tags", 0]).dirty).toEqualTypeOf<boolean>();
    expectTypeOf(local.root.at("tags").item("k").peek().dirty).toEqualTypeOf<boolean>();
    // @ts-expect-error: the form has no dirty()
    void bare.root.at("name").peek().dirty;
    // @ts-expect-error: the form has no dirty()
    void bare.getSnapshot(["name"]).dirty;
  });

  it("include changes() only with dirty()", () => {
    expectTypeOf(tracked.changes()).toEqualTypeOf<readonly Change[]>();
    expectTypeOf(local.changes(["tags"])).toEqualTypeOf<readonly Change[]>();
    // @ts-expect-error: the form has no dirty()
    bare.changes();
  });

  it("leave a store with dirty() assignable where none is asked for", () => {
    expectTypeOf(tracked).toExtend<FormStore<{ name: string; tags: string[] }>>();
    expectTypeOf(tracked.root.at("name").peek()).toExtend<FieldSnapshot<string>>();
    expectTypeOf(tracked.getFormSnapshot()).toExtend<FormSnapshot>();
    expectTypeOf(bare).not.toExtend<FormStore<{ name: string; tags: string[] }, FormError, undefined, unknown, {}, "dirty">>();
  });
});
