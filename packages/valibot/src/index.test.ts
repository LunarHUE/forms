import { createFormsCore } from "@lunarhue/forms-core";
import type { Path } from "@lunarhue/forms-core";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { valibot, type ValibotSchema } from "./index.js";

const defaultValue = (schema: ValibotSchema) => valibot().defaultValue(schema);
const itemValue = (schema: ValibotSchema, path: Path) => valibot().itemValue(schema, path);

const auth = v.variant("type", [
  v.object({ type: v.literal("password"), password: v.string() }),
  v.object({ type: v.literal("key"), key: v.string(), port: v.number() }),
]);

const schema = v.object({
  hostname: v.pipe(v.string(), v.minLength(1)),
  enabled: v.boolean(),
  port: v.number(),
  role: v.picklist(["server", "agent"]),
  note: v.optional(v.string()),
  owner: v.nullable(v.string()),
  alias: v.nullish(v.string()),
  retries: v.optional(v.number(), 3),
  tags: v.array(v.string()),
  disks: v.array(v.object({ device: v.string(), size: v.number() })),
  auth,
  meta: v.record(v.string(), v.string()),
  either: v.union([v.string(), v.number()]),
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
    expect(defaultValue(v.string())).toBe("");
    expect(defaultValue(v.boolean())).toBe(false);
    expect(defaultValue(v.array(v.number()))).toEqual([]);
  });

  it("leaves a value with no empty value of its type undefined", () => {
    for (const s of [v.number(), v.picklist(["a"]), v.date(), v.bigint(), v.tuple([v.string()]), v.unknown()])
      expect(defaultValue(s)).toBeUndefined();
  });

  it("uses a literal's value", () => {
    expect(defaultValue(v.literal("on"))).toBe("on");
  });

  it("recurses into every kind of object", () => {
    const entries = { a: v.string(), b: v.object({ c: v.boolean() }) };
    const expected = { a: "", b: { c: false } };
    expect(defaultValue(v.looseObject(entries))).toEqual(expected);
    expect(defaultValue(v.strictObject(entries))).toEqual(expected);
    expect(defaultValue(v.objectWithRest(entries, v.number()))).toEqual(expected);
  });

  it("gives wrappers their declared default, else null for nullable and undefined for the rest", () => {
    expect(defaultValue(v.optional(v.string()))).toBeUndefined();
    expect(defaultValue(v.exactOptional(v.string()))).toBeUndefined();
    expect(defaultValue(v.undefinedable(v.string()))).toBeUndefined();
    expect(defaultValue(v.nullish(v.string()))).toBeUndefined();
    expect(defaultValue(v.nullable(v.string()))).toBeNull();
    expect(defaultValue(v.optional(v.string(), "x"))).toBe("x");
    expect(defaultValue(v.exactOptional(v.string(), "x"))).toBe("x");
    expect(defaultValue(v.undefinedable(v.string(), "x"))).toBe("x");
    expect(defaultValue(v.nullable(v.string(), "x"))).toBe("x");
    expect(defaultValue(v.nullish(v.number(), () => 1))).toBe(1);
  });

  it("ignores an async default", () => {
    expect(defaultValue(v.optionalAsync(v.string(), async () => "x"))).toBeUndefined();
    expect(defaultValue(v.nullableAsync(v.string(), async () => "x"))).toBeNull();
  });

  it("looks through non-optional wrappers to the wrapped schema", () => {
    expect(defaultValue(v.nonOptional(v.optional(v.string())))).toBeUndefined();
    expect(defaultValue(v.nonNullable(v.string()))).toBe("");
    expect(defaultValue(v.nonNullish(v.object({ a: v.boolean() })))).toEqual({ a: false });
  });

  it("reads a pipe as its first schema", () => {
    expect(defaultValue(v.pipe(v.string(), v.trim(), v.minLength(1)))).toBe("");
    expect(defaultValue(v.pipe(v.object({ a: v.string() }), v.check(() => true)))).toEqual({ a: "" });
    expect(defaultValue(v.pipeAsync(v.string(), v.checkAsync(async () => true)))).toBe("");
  });

  it("starts a variant on its first option, through nested variants", () => {
    const nested = v.variant("kind", [
      v.variant("type", [v.object({ kind: v.literal("a"), type: v.literal("x"), x: v.string() })]),
      v.object({ kind: v.literal("b") }),
    ]);
    expect(defaultValue(auth)).toEqual({ type: "password", password: "" });
    expect(defaultValue(nested)).toEqual({ kind: "a", type: "x", x: "" });
  });

  it("leaves a lazy schema undefined", () => {
    interface Tree {
      name: string;
      children: Tree[];
    }
    const tree: v.GenericSchema<Tree> = v.lazy(() => v.object({ name: v.string(), children: v.array(tree) }));
    expect(defaultValue(tree)).toBeUndefined();
  });

  it("handles async schemas like sync ones", () => {
    const s = v.objectAsync({
      name: v.pipeAsync(v.string(), v.checkAsync(async () => true)),
      rows: v.arrayAsync(v.objectAsync({ t: v.boolean() })),
    });
    expect(defaultValue(s)).toEqual({ name: "", rows: [] });
  });
});

describe("itemValue", () => {
  it("gives the item default of an array at the root", () => {
    expect(itemValue(v.array(v.object({ t: v.string() })), [])).toEqual({ t: "" });
    expect(itemValue(v.array(v.number()), [])).toBeUndefined();
  });

  it("walks objects and wrappers to a nested array", () => {
    expect(itemValue(schema, ["disks"])).toEqual({ device: "", size: undefined });
    expect(itemValue(schema, ["tags"])).toBe("");
    const wrapped = v.object({ a: v.optional(v.object({ list: v.nullable(v.array(v.boolean())) })) });
    expect(itemValue(wrapped, ["a", "list"])).toBe(false);
  });

  it("treats any segment under an array as its item", () => {
    const grid = v.object({ rows: v.array(v.array(v.object({ cell: v.string() }))) });
    expect(itemValue(grid, ["rows"])).toEqual([]);
    expect(itemValue(grid, ["rows", "k0"])).toEqual({ cell: "" });
    expect(itemValue(grid, ["rows", "anything"])).toEqual({ cell: "" });
    const nested = v.array(v.object({ tags: v.array(v.string()) }));
    expect(itemValue(nested, ["k3", "tags"])).toBe("");
  });

  it("walks into variant options and lazy schemas", () => {
    const s = v.variant("type", [
      v.object({ type: v.literal("a") }),
      v.object({ type: v.literal("b"), list: v.array(v.literal("x")) }),
    ]);
    expect(itemValue(s, ["list"])).toBe("x");
    expect(itemValue(v.lazy(() => v.object({ list: v.array(v.string()) })), ["list"])).toBe("");
    interface Tree {
      name: string;
      children: Tree[];
    }
    const tree: v.GenericSchema<Tree> = v.lazy(() => v.object({ name: v.string(), children: v.array(tree) }));
    // Each item is the lazy schema itself, which has no value of its own.
    expect(itemValue(tree, ["children"])).toBeUndefined();
    expect(itemValue(v.object({ tree }), ["tree", "children", "k0", "children"])).toBeUndefined();
    expect(itemValue(v.object({ list: v.array(tree) }), ["list", "k0", "children"])).toBeUndefined();
  });

  it("is undefined when the path doesn't lead to an array", () => {
    expect(itemValue(schema, ["hostname"])).toBeUndefined();
    expect(itemValue(schema, ["nope"])).toBeUndefined();
    expect(itemValue(schema, ["hostname", "deeper"])).toBeUndefined();
    expect(itemValue(schema, [])).toBeUndefined();
  });
});

describe("the adapter", () => {
  it("names the valibot vendor, which every valibot schema reports", () => {
    expect(valibot().vendor).toBe("valibot");
    expect(schema["~standard"].vendor).toBe(valibot().vendor);
    expect(valibot()).toBe(valibot());
  });
});

describe("with core", () => {
  const core = createFormsCore({ schemas: [valibot()] });

  const profile = v.object({
    name: v.pipe(v.string(), v.minLength(1, "Name required")),
    age: v.pipe(v.string(), v.digits("Digits only"), v.transform(Number)),
    address: v.object({ city: v.string(), zip: v.string() }),
    rows: v.array(v.object({ title: v.pipe(v.string(), v.minLength(1, "Title required")), done: v.boolean() })),
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

  it("lands valibot issues on nested and array item fields", async () => {
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

  it("validates with an async schema", async () => {
    const taken = v.objectAsync({
      user: v.pipeAsync(
        v.string(),
        v.checkAsync(async (name) => name !== "admin", "Taken"),
      ),
    });
    const store = core.define({ schema: taken, defaultValues: { user: "admin" } }).createStore();
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(store.root.at("user").peek().errors).toEqual([expect.objectContaining({ message: "Taken" })]);
    store.root.at("user").setValue("ada");
    expect(await store.submit()).toEqual({ status: "succeeded", result: undefined });
  });
});
