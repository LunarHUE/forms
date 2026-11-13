import { createFormsCore, type FormStore, type HasAdapter, type LeafHandle, type StandardSchemaV1 } from "@lunarhue/forms-core";
import * as v from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import * as zm from "zod/mini";
import { valibot } from "./valibot.js";
import { zod, type ZodSchema } from "./zod.js";

type Adapters = readonly [ReturnType<typeof zod>];

const user = z.object({ name: z.string(), age: z.string().transform(Number) });
const mini = zm.object({ name: zm.string(), tags: zm.array(zm.string()) });
const fromValibot = v.object({ name: v.string() });

// A schema from a vendor no adapter is registered for.
declare const other: StandardSchemaV1<{ name: string }> & { readonly other: true };

describe("zod()", () => {
  it("supports concrete zod and zod/mini schemas", () => {
    expectTypeOf<HasAdapter<typeof user, Adapters>>().toEqualTypeOf<true>();
    expectTypeOf<HasAdapter<typeof mini, Adapters>>().toEqualTypeOf<true>();
    expectTypeOf<HasAdapter<z.ZodArray<z.ZodString>, Adapters>>().toEqualTypeOf<true>();
    expectTypeOf<HasAdapter<typeof fromValibot, Adapters>>().toEqualTypeOf<false>();
    expectTypeOf<HasAdapter<typeof other, Adapters>>().toEqualTypeOf<false>();
    expectTypeOf(user).toExtend<ZodSchema>();
    expectTypeOf(mini).toExtend<ZodSchema>();
  });

  it("makes defaultValues optional for a zod schema", () => {
    const core = createFormsCore({ schemas: [zod()] });
    const store = core.define({ schema: user }).createStore();
    expectTypeOf(store).toEqualTypeOf<FormStore<{ name: string; age: string }>>();
    core.define({ schema: mini });
    core.define({ schema: user, defaultValues: { name: "Ada" } });
    core.define({
      schema: user,
      onSubmit: (value) => {
        expectTypeOf(value).toEqualTypeOf<{ name: string; age: number }>();
      },
    });
  });

  it("types the value as the draft of the schema's input", () => {
    const core = createFormsCore({ schemas: [zod()] });
    const order = z.object({
      title: z.string(),
      qty: z.number(),
      kind: z.enum(["a", "b"]),
      fixed: z.literal("x"),
      lines: z.array(z.object({ sku: z.string(), price: z.number() })),
      auth: z.discriminatedUnion("type", [
        z.object({ type: z.literal("password"), password: z.string() }),
        z.object({ type: z.literal("key"), port: z.number() }),
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

  it("still requires defaultValues for a valibot schema", () => {
    const core = createFormsCore({ schemas: [zod()] });
    // @ts-expect-error: no registered adapter supports this schema
    core.define({ schema: fromValibot });
    const store = core.define({ schema: fromValibot, defaultValues: { name: "" } }).createStore();
    expectTypeOf(store).toEqualTypeOf<FormStore<{ name: string }>>();
  });

  it("makes defaultValues optional for both vendors when both adapters are registered", () => {
    const core = createFormsCore({ schemas: [zod(), valibot()] });
    expectTypeOf(core.define({ schema: user }).createStore()).toEqualTypeOf<FormStore<{ name: string; age: string }>>();
    expectTypeOf(core.define({ schema: fromValibot }).createStore()).toEqualTypeOf<FormStore<{ name: string }>>();
    // @ts-expect-error: no registered adapter supports this schema
    core.define({ schema: other });
  });
});
