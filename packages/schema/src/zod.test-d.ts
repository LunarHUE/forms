import {
  createFormsCore,
  type FormError,
  type FormStore,
  type LeafHandle,
  type NoSchemaPlugin,
  type Plugins,
  type SchemaDefinition,
  type StandardSchemaV1,
} from "@lunarhue/forms-core";
import * as v from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import * as zm from "zod/mini";
import { valibot } from "./valibot.js";
import { zod, type ZodSchema } from "./zod.js";

type Installed = readonly [ReturnType<typeof zod>];

/** Whether a schema plugin in `P` accepts `S`, read off whether `define` still requires defaultValues. */
/** A store of a form with `zod()`. */
type ZodStore<V> = FormStore<V, FormError, undefined, unknown, {}, "zod">;

type HasSchemaPlugin<S extends StandardSchemaV1, P extends Plugins> =
  SchemaDefinition<S, P, FormError, undefined, unknown> extends NoSchemaPlugin<S> ? false : true;

const user = z.object({ name: z.string(), age: z.string().transform(Number) });
const mini = zm.object({ name: zm.string(), tags: zm.array(zm.string()) });
const fromValibot = v.object({ name: v.string() });

// A schema from a vendor no installed plugin accepts.
declare const other: StandardSchemaV1<{ name: string }> & { readonly other: true };

describe("zod()", () => {
  it("supports concrete zod and zod/mini schemas", () => {
    expectTypeOf<HasSchemaPlugin<typeof user, Installed>>().toEqualTypeOf<true>();
    expectTypeOf<HasSchemaPlugin<typeof mini, Installed>>().toEqualTypeOf<true>();
    expectTypeOf<HasSchemaPlugin<z.ZodArray<z.ZodString>, Installed>>().toEqualTypeOf<true>();
    expectTypeOf<HasSchemaPlugin<typeof fromValibot, Installed>>().toEqualTypeOf<false>();
    expectTypeOf<HasSchemaPlugin<typeof other, Installed>>().toEqualTypeOf<false>();
    expectTypeOf(user).toExtend<ZodSchema>();
    expectTypeOf(mini).toExtend<ZodSchema>();
  });

  it("makes defaultValues optional for a zod schema", () => {
    const core = createFormsCore({ plugins: [zod()] });
    const store = core.define({ schema: user }).createStore();
    expectTypeOf(store).toEqualTypeOf<ZodStore<{ name: string; age: string }>>();
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
    const core = createFormsCore({ plugins: [zod()] });
    const order = z.object({
      title: z.string(),
      qty: z.number(),
      kind: z.enum(["a", "b"]),
      fixed: z.literal("x"),
      channels: z.array(z.enum(["email", "sms"])),
      lines: z.array(z.object({ sku: z.string(), price: z.number() })),
      auth: z.discriminatedUnion("type", [
        z.object({ type: z.literal("password"), password: z.string() }),
        z.object({ type: z.literal("key"), port: z.number() }),
      ]),
    });
    const store = core.define({ schema: order }).createStore();
    expectTypeOf(store).toEqualTypeOf<
      ZodStore<{
        title: string;
        qty: number | undefined;
        kind: "a" | "b" | undefined;
        fixed: "x";
        channels: ("email" | "sms")[];
        lines: { sku: string; price: number | undefined }[];
        auth: { type: "password"; password: string } | { type: "key"; port: number | undefined };
      }>
    >();
    expectTypeOf(store.root.at("qty")).toEqualTypeOf<LeafHandle<number | undefined, FormError, "zod">>();
    store.root.at("lines").push({ sku: "", price: undefined });
    store.root.at("channels").push("sms");
    // @ts-expect-error: the schema plugin has no empty channel to add
    store.root.at("channels").push();
  });

  it("still requires defaultValues for a valibot schema", () => {
    const core = createFormsCore({ plugins: [zod()] });
    // @ts-expect-error: no installed schema plugin accepts this schema, so defaultValues is required
    core.define({ schema: fromValibot });
    const store = core.define({ schema: fromValibot, defaultValues: { name: "" } }).createStore();
    expectTypeOf(store).toEqualTypeOf<ZodStore<{ name: string }>>();
    expectTypeOf<HasSchemaPlugin<typeof fromValibot, Installed>>().toEqualTypeOf<false>();
  });

  it("makes defaultValues optional for both vendors when both schema plugins are installed", () => {
    const core = createFormsCore({ plugins: [zod(), valibot()] });
    expectTypeOf(core.define({ schema: user }).createStore()).toEqualTypeOf<FormStore<{ name: string; age: string }, FormError, undefined, unknown, {}, "zod" | "valibot">>();
    expectTypeOf(core.define({ schema: fromValibot }).createStore()).toEqualTypeOf<FormStore<{ name: string }, FormError, undefined, unknown, {}, "zod" | "valibot">>();
    // @ts-expect-error: no installed schema plugin accepts this schema
    core.define({ schema: other });
  });
});
