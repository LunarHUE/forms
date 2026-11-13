import { createFormsCore, type FormStore, type HasAdapter, type LeafHandle, type StandardSchemaV1 } from "@lunarhue/forms-core";
import * as v from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import { valibot, type ValibotSchema } from "./valibot.js";

type Adapters = readonly [ReturnType<typeof valibot>];

const user = v.object({ name: v.string(), age: v.pipe(v.string(), v.transform(Number)) });
const userAsync = v.objectAsync({ name: v.pipeAsync(v.string(), v.checkAsync(async () => true)) });

// A schema from a vendor no adapter is registered for.
declare const other: StandardSchemaV1<{ name: string }> & { readonly other: true };

describe("valibot()", () => {
  it("supports concrete sync and async valibot schemas", () => {
    expectTypeOf<HasAdapter<typeof user, Adapters>>().toEqualTypeOf<true>();
    expectTypeOf<HasAdapter<typeof userAsync, Adapters>>().toEqualTypeOf<true>();
    expectTypeOf<HasAdapter<v.ArraySchema<v.StringSchema<undefined>, undefined>, Adapters>>().toEqualTypeOf<true>();
    expectTypeOf<HasAdapter<typeof other, Adapters>>().toEqualTypeOf<false>();
    expectTypeOf(user).toExtend<ValibotSchema>();
  });

  it("makes defaultValues optional for a valibot schema", () => {
    const core = createFormsCore({ schemas: [valibot()] });
    const store = core.define({ schema: user }).createStore();
    expectTypeOf(store).toEqualTypeOf<FormStore<{ name: string; age: string }>>();
    core.define({ schema: userAsync });
    core.define({ schema: user, defaultValues: { name: "Ada" } });
    core.define({
      schema: user,
      onSubmit: (value) => {
        expectTypeOf(value).toEqualTypeOf<{ name: string; age: number }>();
      },
    });
  });

  it("types the value as the draft of the schema's input", () => {
    const core = createFormsCore({ schemas: [valibot()] });
    const order = v.object({
      title: v.string(),
      qty: v.number(),
      kind: v.picklist(["a", "b"]),
      fixed: v.literal("x"),
      lines: v.array(v.object({ sku: v.string(), price: v.number() })),
      auth: v.variant("type", [
        v.object({ type: v.literal("password"), password: v.string() }),
        v.object({ type: v.literal("key"), port: v.number() }),
      ]),
    });
    const store = core.define({ schema: order }).createStore();
    expectTypeOf(store).toEqualTypeOf<
      FormStore<{
        title: string;
        qty: number | undefined;
        kind: "a" | "b" | undefined;
        fixed: "x";
        lines: { sku: string; price: number | undefined }[];
        auth: { type: "password"; password: string } | { type: "key"; port: number | undefined };
      }>
    >();
    expectTypeOf(store.root.at("qty")).toEqualTypeOf<LeafHandle<number | undefined>>();
    store.root.at("lines").push({ sku: "", price: undefined });
  });

  it("still requires defaultValues for a schema of another vendor", () => {
    const core = createFormsCore({ schemas: [valibot()] });
    // @ts-expect-error: no registered adapter supports this schema
    core.define({ schema: other });
    const store = core.define({ schema: other, defaultValues: { name: "" } }).createStore();
    expectTypeOf(store).toEqualTypeOf<FormStore<{ name: string }>>();
  });
});
