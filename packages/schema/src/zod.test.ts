import { createFormsCore } from "@lunarhue/forms-core";
import type { Path } from "@lunarhue/forms-core";
import * as v from "valibot";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import * as zm from "zod/mini";
import * as z3 from "zod/v3";
import { valibot } from "./valibot.js";
import { zod, type ZodSchema } from "./zod.js";

const defaultValue = (schema: ZodSchema) => zod().schema.defaultValue(schema);
const itemValue = (schema: ZodSchema, path: Path) => zod().schema.itemValue(schema, path);

const auth = z.discriminatedUnion("type", [
  z.object({ type: z.literal("password"), password: z.string() }),
  z.object({ type: z.literal("key"), key: z.string(), port: z.number() }),
]);

const schema = z.object({
  hostname: z.string().min(1),
  enabled: z.boolean(),
  port: z.number(),
  role: z.enum(["server", "agent"]),
  note: z.string().optional(),
  owner: z.string().nullable(),
  alias: z.string().nullish(),
  retries: z.number().default(3),
  tags: z.array(z.string()),
  disks: z.array(z.object({ device: z.string(), size: z.number() })),
  auth,
  meta: z.record(z.string(), z.string()),
  either: z.union([z.string(), z.number()]),
});

describe("defaultValue", () => {
  it("follows the rules for every schema kind", () => {
    expect(defaultValue(schema)).toEqual({
      hostname: "",
      enabled: false,
      port: undefined,
      role: undefined,
      note: undefined,
      owner: null,
      alias: undefined,
      retries: 3,
      tags: [],
      disks: [],
      auth: { type: "password", password: "" },
      meta: undefined,
      either: undefined,
    });
  });

  it("starts strings empty, booleans false and arrays empty", () => {
    expect(defaultValue(z.string())).toBe("");
    expect(defaultValue(z.email())).toBe("");
    expect(defaultValue(z.boolean())).toBe(false);
    expect(defaultValue(z.array(z.number()))).toEqual([]);
  });

  it("leaves a value with no empty value of its type undefined", () => {
    for (const s of [
      z.number(),
      z.int(),
      z.enum(["a"]),
      z.date(),
      z.bigint(),
      z.tuple([z.string()]),
      z.unknown(),
      z.intersection(z.object({ a: z.string() }), z.object({ b: z.string() })),
    ])
      expect(defaultValue(s)).toBeUndefined();
  });

  it("uses a literal's first value", () => {
    expect(defaultValue(z.literal("on"))).toBe("on");
    expect(defaultValue(z.literal(["a", "b"]))).toBe("a");
  });

  it("recurses into every kind of object", () => {
    const shape = { a: z.string(), b: z.object({ c: z.boolean() }) };
    const expected = { a: "", b: { c: false } };
    expect(defaultValue(z.looseObject(shape))).toEqual(expected);
    expect(defaultValue(z.strictObject(shape))).toEqual(expected);
    expect(defaultValue(z.object(shape).catchall(z.number()))).toEqual(expected);
  });

  it("gives wrappers a declared default, else null for nullable and undefined for the rest", () => {
    expect(defaultValue(z.string().optional())).toBeUndefined();
    expect(defaultValue(z.string().exactOptional())).toBeUndefined();
    expect(defaultValue(z.string().nullish())).toBeUndefined();
    expect(defaultValue(z.string().nullable())).toBeNull();
    expect(defaultValue(z.string().optional().default("x"))).toBe("x");
    expect(defaultValue(z.string().default("x").optional())).toBe("x");
    expect(defaultValue(z.string().default("x").nullable())).toBe("x");
    expect(defaultValue(z.string().nullable().default(null))).toBeNull();
    expect(defaultValue(z.number().default(() => 1))).toBe(1);
  });

  it("uses a prefault, which is an input value", () => {
    expect(defaultValue(z.string().prefault("x"))).toBe("x");
    expect(defaultValue(z.string().transform(Number).prefault("4"))).toBe("4");
  });

  it("gives each call a fresh copy of an object default", () => {
    const s = z.object({ a: z.string() }).default({ a: "x" });
    const first = defaultValue(s);
    expect(first).toEqual({ a: "x" });
    expect(defaultValue(s)).not.toBe(first);
  });

  it("looks through non-optional, readonly and catch to the inner schema", () => {
    expect(defaultValue(z.string().optional().nonoptional())).toBeUndefined();
    expect(defaultValue(z.object({ a: z.boolean() }).readonly())).toEqual({ a: false });
    expect(defaultValue(z.string().catch("x"))).toBe("");
  });

  it("reads a pipe as its input side", () => {
    expect(defaultValue(z.string().trim().min(1))).toBe("");
    expect(defaultValue(z.string().transform(Number))).toBe("");
    expect(defaultValue(z.string().pipe(z.coerce.number()))).toBe("");
    expect(defaultValue(z.object({ a: z.string() }).refine(() => true))).toEqual({ a: "" });
    // A preprocess pipe's input side is a transform, whose input is unknown.
    expect(defaultValue(z.preprocess(String, z.string()))).toBeUndefined();
  });

  it("starts a discriminated union on its first option, through nested ones", () => {
    const nested = z.discriminatedUnion("kind", [
      z.discriminatedUnion("type", [z.object({ kind: z.literal("a"), type: z.literal("x"), x: z.string() })]),
      z.object({ kind: z.literal("b") }),
    ]);
    expect(defaultValue(auth)).toEqual({ type: "password", password: "" });
    expect(defaultValue(nested)).toEqual({ kind: "a", type: "x", x: "" });
  });

  it("leaves a lazy schema undefined", () => {
    interface Tree {
      name: string;
      children: Tree[];
    }
    const tree: z.ZodType<Tree> = z.lazy(() => z.object({ name: z.string(), children: z.array(tree) }));
    expect(defaultValue(tree)).toBeUndefined();
  });

  it("follows getters in a recursive object", () => {
    const category = z.object({
      name: z.string(),
      get children() {
        return z.array(category);
      },
    });
    expect(defaultValue(category)).toEqual({ name: "", children: [] });
  });

  it("handles zod/mini schemas like classic ones", () => {
    const s = zm.object({
      name: zm.string().check(zm.minLength(1)),
      note: zm.optional(zm.string()),
      // oxlint-disable-next-line no-underscore-dangle
      count: zm._default(zm.number(), 2),
      rows: zm.array(zm.object({ t: zm.boolean() })),
    });
    expect(defaultValue(s)).toEqual({ name: "", note: undefined, count: 2, rows: [] });
    expect(itemValue(s, ["rows"])).toEqual({ t: false });
  });

  it("gives undefined for a Zod 3 schema, which reports the same vendor", () => {
    const old = z3.object({ a: z3.string() });
    expect(old["~standard"].vendor).toBe(zod().schema.vendor);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const asZod = old as unknown as ZodSchema;
    expect(defaultValue(asZod)).toBeUndefined();
    expect(itemValue(asZod, ["a"])).toBeUndefined();
  });
});

describe("itemValue", () => {
  it("gives the item default of an array at the root", () => {
    expect(itemValue(z.array(z.object({ t: z.string() })), [])).toEqual({ t: "" });
    expect(itemValue(z.array(z.number()), [])).toBeUndefined();
    // An enum item has no empty value, so a checkbox group's array has to be given one.
    expect(itemValue(z.array(z.enum(["email", "sms"])), [])).toBeUndefined();
    expect(itemValue(z.array(z.enum(["email", "sms"]).nullable()), [])).toBeNull();
  });

  it("walks objects, wrappers and pipes to a nested array", () => {
    expect(itemValue(schema, ["disks"])).toEqual({ device: "", size: undefined });
    expect(itemValue(schema, ["tags"])).toBe("");
    const wrapped = z.object({
      a: z.object({ list: z.array(z.boolean()).nullable().default([]) }).optional(),
      b: z.array(z.string()).min(1).transform((list) => list.join()),
    });
    expect(itemValue(wrapped, ["a", "list"])).toBe(false);
    expect(itemValue(wrapped, ["b"])).toBe("");
  });

  it("treats any segment under an array as its item", () => {
    const grid = z.object({ rows: z.array(z.array(z.object({ cell: z.string() }))) });
    expect(itemValue(grid, ["rows"])).toEqual([]);
    expect(itemValue(grid, ["rows", "k0"])).toEqual({ cell: "" });
    expect(itemValue(grid, ["rows", "anything"])).toEqual({ cell: "" });
    const nested = z.array(z.object({ tags: z.array(z.string()) }));
    expect(itemValue(nested, ["k3", "tags"])).toBe("");
  });

  it("walks into discriminated union options and lazy schemas", () => {
    const s = z.discriminatedUnion("type", [
      z.object({ type: z.literal("a") }),
      z.object({ type: z.literal("b"), list: z.array(z.literal("x")) }),
    ]);
    expect(itemValue(s, ["list"])).toBe("x");
    expect(itemValue(z.lazy(() => z.object({ list: z.array(z.string()) })), ["list"])).toBe("");
    interface Tree {
      name: string;
      children: Tree[];
    }
    const tree: z.ZodType<Tree> = z.lazy(() => z.object({ name: z.string(), children: z.array(tree) }));
    // Each item is the lazy schema itself, which has no value of its own.
    expect(itemValue(tree, ["children"])).toBeUndefined();
    expect(itemValue(z.object({ tree }), ["tree", "children", "k0", "children"])).toBeUndefined();
    const category = z.object({
      name: z.string(),
      get children() {
        return z.array(category);
      },
    });
    expect(itemValue(category, ["children", "k0", "children"])).toEqual({ name: "", children: [] });
  });

  it("is undefined when the path doesn't lead to an array", () => {
    expect(itemValue(schema, ["hostname"])).toBeUndefined();
    expect(itemValue(schema, ["nope"])).toBeUndefined();
    expect(itemValue(schema, ["hostname", "deeper"])).toBeUndefined();
    expect(itemValue(schema, ["either"])).toBeUndefined();
    expect(itemValue(schema, [])).toBeUndefined();
  });
});

describe("the plugin", () => {
  it("names the zod vendor, which classic and mini schemas report", () => {
    expect(zod().schema.vendor).toBe("zod");
    expect(schema["~standard"].vendor).toBe(zod().schema.vendor);
    expect(zm.string()["~standard"].vendor).toBe(zod().schema.vendor);
    expect(zod()).toBe(zod());
  });
});

describe("with core", () => {
  const core = createFormsCore({ plugins: [zod()] });

  const profile = z.object({
    name: z.string().min(1, "Name required"),
    age: z
      .string()
      .regex(/^\d+$/, "Digits only")
      .transform(Number),
    address: z.object({ city: z.string(), zip: z.string() }),
    rows: z.array(z.object({ title: z.string().min(1, "Title required"), done: z.boolean() })),
  });

  it("starts from the schema's defaults with no defaultValues", () => {
    const store = core.define({ schema: profile }).createStore();
    expect(store.root.peek().value).toEqual({ name: "", age: "", address: { city: "", zip: "" }, rows: [] });
  });

  it("merges partial defaultValues over the schema's defaults", () => {
    const store = core.define({ schema: profile, defaultValues: { address: { city: "Paris" } } }).createStore();
    expect(store.root.peek().value).toEqual({ name: "", age: "", address: { city: "Paris", zip: "" }, rows: [] });
  });

  it("adds the item default on a bare push", () => {
    const store = core.define({ schema: profile }).createStore();
    store.root.at("rows").push();
    expect(store.root.at("rows").peek().value).toEqual([{ title: "", done: false }]);
  });

  it("lands zod issues on nested and array item fields", async () => {
    const store = core
      .define({ schema: profile, defaultValues: { name: "Ada", age: "1", rows: [{ title: "a", done: false }] } })
      .createStore();
    const rows = store.root.at("rows");
    rows.push();
    const [first, second] = rows.peek().keys;
    if (!first || !second) throw new Error("expected two rows");
    store.root.at("age").setValue("x");
    expect(await store.validate()).toBe(false);
    expect(store.root.at("age").peek().errors).toEqual([expect.objectContaining({ message: "Digits only" })]);
    expect(rows.item(first).at("title").peek().errors).toEqual([]);
    expect(rows.item(second).at("title").peek().errors).toEqual([expect.objectContaining({ message: "Title required" })]);
    expect(store.root.at("name").peek().errors).toEqual([]);
  });

  it("passes a transforming schema's output to onSubmit", async () => {
    const outputs: unknown[] = [];
    const store = core
      .define({
        schema: profile,
        defaultValues: { name: "Ada", age: "36" },
        onSubmit: (value, ctx) => {
          outputs.push(value, ctx.input);
          return value.age + 1;
        },
      })
      .createStore();
    expect(await store.submit()).toEqual({ status: "succeeded", result: 37 });
    expect(outputs).toEqual([
      { name: "Ada", age: 36, address: { city: "", zip: "" }, rows: [] },
      { name: "Ada", age: "36", address: { city: "", zip: "" }, rows: [] },
    ]);
  });

  it("types a number field as undefined until filled in, and submits a number", async () => {
    const order = z.object({ title: z.string(), qty: z.number() });
    const submitted: number[] = [];
    const store = core
      .define({
        schema: order,
        onSubmit: (value) => {
          expectTypeOf(value.qty).toEqualTypeOf<number>();
          submitted.push(value.qty);
        },
      })
      .createStore();
    const qty = store.root.at("qty");
    expectTypeOf(qty.peek().value).toEqualTypeOf<number | undefined>();
    expect(qty.peek().value).toBeUndefined();
    expect(await store.submit()).toEqual({ status: "invalid" });
    qty.setValue(2);
    expect(await store.submit()).toEqual({ status: "succeeded", result: undefined });
    expect(submitted).toEqual([2]);
  });

  it("validates with an async refinement", async () => {
    const taken = z.object({
      user: z.string().refine(async (name) => name !== "admin", "Taken"),
    });
    const store = core.define({ schema: taken, defaultValues: { user: "admin" } }).createStore();
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(store.root.at("user").peek().errors).toEqual([expect.objectContaining({ message: "Taken" })]);
    store.root.at("user").setValue("ada");
    expect(await store.submit()).toEqual({ status: "succeeded", result: undefined });
  });

  it("works next to the valibot plugin, each schema with its own", () => {
    const both = createFormsCore({ plugins: [zod(), valibot()] });
    const fromZod = both.define({ schema: z.object({ a: z.string(), list: z.array(z.boolean()) }) }).createStore();
    const fromValibot = both.define({ schema: v.object({ b: v.boolean(), list: v.array(v.string()) }) }).createStore();
    expect(fromZod.root.peek().value).toEqual({ a: "", list: [] });
    expect(fromValibot.root.peek().value).toEqual({ b: false, list: [] });
    fromZod.root.at("list").push();
    fromValibot.root.at("list").push();
    expect(fromZod.root.at("list").peek().value).toEqual([false]);
    expect(fromValibot.root.at("list").peek().value).toEqual([""]);
  });
});
