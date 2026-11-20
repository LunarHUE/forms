import {
  createFormsCore,
  type FormError,
  type FormStore,
  type LeafHandle,
  type NoSchemaPlugin,
  type Plugins,
  type SchemaDefinition,
  type StandardSchemaV1,
  fieldValidators,
} from "@lunarhue/forms-core";
import { arrays } from "@lunarhue/forms-core/plugins";
import * as v from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import { valibot, type ValibotSchema } from "./valibot.js";

type Installed = readonly [ReturnType<typeof valibot>];

/** Whether a schema plugin in `P` accepts `S`, read off whether `define` still requires defaultValues. */
/** A store of a form with `valibot()`. */
type ValibotStore<V> = FormStore<V, FormError, undefined, unknown, {}, "valibot">;

type HasSchemaPlugin<S extends StandardSchemaV1, P extends Plugins> =
  SchemaDefinition<S, P, FormError, undefined, unknown> extends NoSchemaPlugin<S> ? false : true;

const user = v.object({ name: v.string(), age: v.pipe(v.string(), v.transform(Number)) });
const userAsync = v.objectAsync({ name: v.pipeAsync(v.string(), v.checkAsync(async () => true)) });

// A schema from a vendor no installed plugin accepts.
declare const other: StandardSchemaV1<{ name: string }> & { readonly other: true };

describe("valibot()", () => {
  it("supports concrete sync and async valibot schemas", () => {
    expectTypeOf<HasSchemaPlugin<typeof user, Installed>>().toEqualTypeOf<true>();
    expectTypeOf<HasSchemaPlugin<typeof userAsync, Installed>>().toEqualTypeOf<true>();
    expectTypeOf<HasSchemaPlugin<v.ArraySchema<v.StringSchema<undefined>, undefined>, Installed>>().toEqualTypeOf<true>();
    expectTypeOf<HasSchemaPlugin<typeof other, Installed>>().toEqualTypeOf<false>();
    expectTypeOf(user).toExtend<ValibotSchema>();
  });

  it("makes defaultValues optional for a valibot schema", () => {
    const core = createFormsCore({ plugins: [valibot()] });
    const store = core.define({ schema: user }).createStore();
    expectTypeOf(store).toEqualTypeOf<ValibotStore<{ name: string; age: string }>>();
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
    const core = createFormsCore({ plugins: [valibot()] });
    const order = v.object({
      title: v.string(),
      qty: v.number(),
      kind: v.picklist(["a", "b"]),
      fixed: v.literal("x"),
      channels: v.array(v.picklist(["email", "sms"])),
      lines: v.array(v.object({ sku: v.string(), price: v.number() })),
      auth: v.variant("type", [
        v.object({ type: v.literal("password"), password: v.string() }),
        v.object({ type: v.literal("key"), port: v.number() }),
      ]),
    });
    const store = core.define({ schema: order }).createStore();
    expectTypeOf(store).toEqualTypeOf<
      ValibotStore<{
        title: string;
        qty: number | undefined;
        kind: "a" | "b" | undefined;
        fixed: "x";
        channels: ("email" | "sms")[];
        lines: { sku: string; price: number | undefined }[];
        auth: { type: "password"; password: string } | { type: "key"; port: number | undefined };
      }>
    >();
    expectTypeOf(store.root.at("qty")).toEqualTypeOf<LeafHandle<number | undefined, FormError, "valibot">>();
    const listed = core.define({ schema: order }).createStore(undefined, { plugins: [arrays()] });
    listed.root.at("lines").push({ sku: "", price: undefined });
    listed.root.at("channels").push("sms");
    // @ts-expect-error: the schema plugin has no empty channel to add
    listed.root.at("channels").push();
  });

  it("still requires defaultValues for a schema of another vendor", () => {
    const core = createFormsCore({ plugins: [valibot()] });
    // @ts-expect-error: no installed schema plugin accepts this schema, so defaultValues is required
    core.define({ schema: other });
    const store = core.define({ schema: other, defaultValues: { name: "" } }).createStore();
    expectTypeOf(store).toEqualTypeOf<ValibotStore<{ name: string }>>();
    expectTypeOf<HasSchemaPlugin<typeof other, Installed>>().toEqualTypeOf<false>();
  });

  it("is what makes defaultValues optional for a valibot schema", () => {
    // @ts-expect-error: valibot() isn't installed, so defaultValues is required
    createFormsCore().define({ schema: user });
    expectTypeOf<SchemaDefinition<typeof user, [], FormError, undefined, unknown>>().toExtend<NoSchemaPlugin<typeof user>>();
    const store = createFormsCore().define({ schema: user, defaultValues: { name: "", age: "" } }).createStore();
    expectTypeOf(store).toEqualTypeOf<FormStore<{ name: string; age: string }>>();
  });

  it("leaves validate to core", () => {
    const core = createFormsCore({ plugins: [valibot()] });
    core.define({ schema: user, validate: { fields: fieldValidators({ name: (value) => (value ? undefined : { message: "Required" }) }) } });
    const plain = createFormsCore().define({ defaultValues: { name: "" }, validate: { fields: fieldValidators({ name: (value) => (value ? undefined : { message: "Required" }) }) } });
    expectTypeOf(plain.createStore()).toEqualTypeOf<FormStore<{ name: string }>>();
  });
});
