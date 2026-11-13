import { describe, expect, it, vi } from "vitest";
import type { Equals } from "./definition.js";
import type { FormError, RawError } from "./errors.js";
import { createFormsCore } from "./index.js";
import type { Path } from "./path.js";
import type { SchemaAdapter } from "./schema-adapter.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import { dirty } from "./plugins/dirty.js";
import { defineSchemaPlugin, validation } from "./plugins/validation.js";

/** A hand-written Standard Schema of vendor `vendor`. */
interface FakeSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly fake: true;
}

type Validate = (value: unknown) => StandardSchemaV1.Result<unknown>;

const passAll: Validate = (value) => ({ value });

const fakeSchema = <I, O = I>(validate: Validate = passAll, vendor = "fake"): FakeSchema<I, O> => ({
  fake: true,
  // The fake's output is whatever type the test names.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  "~standard": { version: 1, vendor, validate: validate as (value: unknown) => StandardSchemaV1.Result<O> },
});

/** A fake schema plugin whose adapter methods are spies. */
const fakeAdapter = (defaults: unknown, item?: unknown, vendor = "fake") => {
  const defaultValue = vi.fn<(schema: FakeSchema<unknown>) => unknown>(() => structuredClone(defaults));
  const itemValue = vi.fn<(schema: FakeSchema<unknown>, path: Path) => unknown>(() => structuredClone(item));
  const adapter: SchemaAdapter<FakeSchema<unknown>> = { vendor, defaultValue, itemValue };
  return { plugin: defineSchemaPlugin(adapter), defaultValue, itemValue };
};

// Core declares no globals beyond es2020, so the tests declare the one they use.
declare function structuredClone<T>(value: T): T;

interface User {
  name: string;
  address: { city: string; zip: string };
  tags: string[];
}

const userDefaults: User = { name: "", address: { city: "", zip: "" }, tags: [] };

const err = (message: string): FormError => ({ message });

describe("defaults", () => {
  it("start from the schema plugin's defaults", () => {
    const { plugin, defaultValue } = fakeAdapter(userDefaults);
    const schema = fakeSchema<User>();
    const store = createFormsCore({ plugins: [plugin] }).define({ schema }).createStore();
    expect(store.root.peek().value).toEqual(userDefaults);
    expect(defaultValue).toHaveBeenCalledWith(schema);
  });

  it("merge partial defaultValues over the schema plugin's, object by object", () => {
    const { plugin } = fakeAdapter({ ...userDefaults, tags: ["a"] });
    const store = createFormsCore({ plugins: [plugin] })
      .define({ schema: fakeSchema<User>(), defaultValues: { name: undefined, address: { city: "Paris" }, tags: ["b", "c"] } })
      .createStore();
    expect(store.root.peek().value).toEqual({ name: "", address: { city: "Paris", zip: "" }, tags: ["b", "c"] });
  });

  it("use complete defaultValues as given when no schema plugin has the schema's vendor", () => {
    const { plugin, defaultValue } = fakeAdapter(userDefaults);
    const defaultValues: User = { name: "Ada", address: { city: "Paris", zip: "75" }, tags: [] };
    const store = createFormsCore({ plugins: [plugin] })
      // The types can't see a vendor. At runtime no plugin has this one, so the complete defaultValues are used.
      .define({ schema: fakeSchema<User>(undefined, "other"), defaultValues })
      .createStore();
    expect(store.root.peek().value).toEqual(defaultValues);
    expect(defaultValue).not.toHaveBeenCalled();
  });

  it("use defaultValues as given without a schema", () => {
    const { plugin, defaultValue } = fakeAdapter(userDefaults);
    const store = createFormsCore({ plugins: [plugin] }).define({ defaultValues: { a: 1 } }).createStore();
    expect(store.root.peek().value).toEqual({ a: 1 });
    expect(defaultValue).not.toHaveBeenCalled();
  });

  it("throw at createStore for a schema with no schema plugin and no defaultValues", () => {
    const schema = fakeSchema<User>(undefined, "other");
    // @ts-expect-error: no schema plugin accepts this schema, so defaultValues is required
    const form = createFormsCore({ plugins: [validation()] }).define({ schema });
    expect(() => form.createStore()).toThrow(/vendor "other".*defaultValues/);
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(() => form.createStore()).toThrow(/^@lunarhue\/forms-core: schema:defaults$/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("ask the first of two schema plugins with the same vendor", () => {
    const first = fakeAdapter({ from: "first" });
    const second = fakeAdapter({ from: "second" });
    const store = createFormsCore({ plugins: [first.plugin, second.plugin] })
      .define({ schema: fakeSchema<{ from: string }>() })
      .createStore();
    expect(store.root.peek().value).toEqual({ from: "first" });
    expect(second.defaultValue).not.toHaveBeenCalled();
  });
});

describe("item values", () => {
  it("come from the schema plugin on a bare push", () => {
    const { plugin, itemValue } = fakeAdapter({ rows: [] }, { title: "" });
    const schema = fakeSchema<{ rows: { title: string }[] }>();
    const store = createFormsCore({ plugins: [plugin] }).define({ schema }).createStore();
    store.root.at("rows").push();
    expect(store.root.peek().value).toEqual({ rows: [{ title: "" }] });
    expect(itemValue).toHaveBeenCalledWith(schema, ["rows"]);
  });

  it("are undefined without a schema", () => {
    const store = createFormsCore().define<{ rows: (string | undefined)[] }>({ defaultValues: { rows: [] } }).createStore();
    store.root.at("rows").push();
    expect(store.root.peek().value).toEqual({ rows: [undefined] });
  });
});

describe("the function form", () => {
  it("runs once per createStore with that store's options", () => {
    const config = vi.fn<(options: { name: string }) => { defaultValues: { name: string } }>((options) => ({
      defaultValues: { name: options.name },
    }));
    const form = createFormsCore().define(config);
    expect(config).not.toHaveBeenCalled();
    const ada = form.createStore({ name: "Ada" });
    const bob = form.createStore({ name: "Bob" });
    expect(config).toHaveBeenCalledTimes(2);
    expect(config.mock.calls).toEqual([[{ name: "Ada" }], [{ name: "Bob" }]]);
    expect(ada.root.peek().value).toEqual({ name: "Ada" });
    expect(bob.root.peek().value).toEqual({ name: "Bob" });
  });

  it("gives each store its own value from a plain config", () => {
    const form = createFormsCore().define({ defaultValues: { name: "" } });
    const one = form.createStore();
    const two = form.createStore();
    one.root.at("name").setValue("x");
    expect(two.root.peek().value).toEqual({ name: "" });
  });
});

const required = (value: string) => (value === "" ? err("Required") : undefined);

describe("shared settings and per-definition overrides", () => {

  it("use the shared show unless the definition has its own", () => {
    const core = createFormsCore({ plugins: [validation()], show: "always" });
    const shared = core.define({ defaultValues: { a: "" }, validate: { fields: { a: required } } }).createStore();
    const own = core.define({ defaultValues: { a: "" }, show: "submitted", validate: { fields: { a: required } } }).createStore();
    void shared.validate();
    void own.validate();
    expect(shared.root.at("a").peek().shownErrors).toEqual([err("Required")]);
    expect(own.root.at("a").peek()).toMatchObject({ errors: [err("Required")], shownErrors: [] });
  });

  it("use the shared timing unless the definition has its own", () => {
    const core = createFormsCore({ plugins: [validation()], validate: "input" });
    const shared = core.define({ defaultValues: { a: "x" }, validate: { fields: { a: required } } }).createStore();
    const own = core.define({ defaultValues: { a: "x" }, validate: { on: "blur", fields: { a: required } } }).createStore();
    shared.root.at("a").setValue("");
    own.root.at("a").setValue("");
    expect(shared.root.at("a").peek().errors).toEqual([err("Required")]);
    expect(own.root.at("a").peek().errors).toEqual([]);
    own.root.at("a").handleBlur();
    expect(own.root.at("a").peek().errors).toEqual([err("Required")]);
  });

  it("ask the definition's equals first, then the shared one, then the default", () => {
    const calls: string[] = [];
    const sharedEquals = vi.fn<Equals>((a, b, ctx, next) => {
      calls.push(`shared ${ctx.path.join(".")}`);
      return next(a, b);
    });
    const ownEquals = vi.fn<Equals>((a, b, ctx, next) => {
      calls.push(`own ${ctx.path.join(".")}`);
      // Case-insensitive names, and the next comparison for everything else.
      if (ctx.path.join(".") === "name" && typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
      return next(a, b);
    });
    const store = createFormsCore({ plugins: [dirty()], equals: sharedEquals })
      .define({ defaultValues: { name: "ada", age: 1 }, equals: ownEquals })
      .createStore();
    store.root.at("name").setValue("ADA");
    expect(store.root.at("name").peek().dirty).toBe(false);
    expect(calls).toContain("own name");
    expect(calls).not.toContain("shared name");
    calls.length = 0;
    store.root.at("age").setValue(2);
    expect(store.root.at("age").peek().dirty).toBe(true);
    // The form may compare a path more than once. Each time the definition's equals is asked first.
    const ages = calls.filter((call) => call.endsWith(" age"));
    expect(ages.length).toBeGreaterThan(0);
    expect(ages).toEqual(ages.map((_, i) => (i % 2 === 0 ? "own age" : "shared age")));
  });

  it("send schema issues and thrown errors through the shared mapError", () => {
    const schema = fakeSchema<{ a: string }>((value) => ({ issues: [{ message: "bad", path: ["a"] }], value }));
    const { plugin } = fakeAdapter({ a: "" });
    const store = createFormsCore({ plugins: [plugin], mapError: (raw) => ({ code: `${raw.source}:${raw.message}` }) })
      .define({
        schema,
        defaultValues: { a: "" },
        validate: {
          fields: {
            a: () => {
              throw new Error("boom");
            },
          },
        },
      })
      .createStore();
    void store.validate();
    expect(store.root.at("a").peek().errors).toEqual(expect.arrayContaining([{ code: "schema:bad" }, { code: "thrown:boom" }]));
  });
});

describe("instance settings", () => {
  it("take the store id from instance.id, and default to form", () => {
    const form = createFormsCore().define({ defaultValues: { name: "" } });
    const store = form.createStore(undefined, { id: "profile" });
    expect(store.id).toBe("profile");
    expect(store.root.at("name").id).toBe("profile--name");
    expect(form.createStore().id).toBe("form");
    expect(form.createStore().id).toBe("form");
  });
});

describe("no side effects", () => {
  it("runs nothing at createFormsCore or define, and only the schema plugin's defaults at createStore", () => {
    const { plugin, defaultValue, itemValue } = fakeAdapter({ a: "", rows: [] });
    const validate = vi.fn<Validate>((value) => ({ value }));
    const field = vi.fn<() => undefined>(() => undefined);
    const form = vi.fn<() => undefined>(() => undefined);
    const onSubmit = vi.fn<() => void>();
    const mapError = vi.fn<(raw: RawError) => FormError>((raw) => ({ message: raw.message }));
    const equals = vi.fn<Equals>((a, b, _ctx, next) => next(a, b));
    const core = createFormsCore({ plugins: [plugin, dirty()], mapError, equals });
    const definition = core.define({
      schema: fakeSchema<{ a: string; rows: string[] }>(validate),
      validate: { on: "input", form, fields: { a: field } },
      equals,
      onSubmit,
    });
    expect(defaultValue).not.toHaveBeenCalled();
    definition.createStore();
    expect(defaultValue).toHaveBeenCalledTimes(1);
    for (const spy of [itemValue, validate, field, form, onSubmit, mapError, equals]) expect(spy).not.toHaveBeenCalled();
  });
});

interface Input {
  name: string;
  age: string;
}
interface Output {
  name: string;
  age: number;
}

const isInput = (value: unknown): value is Input =>
  typeof value === "object" && value !== null && "name" in value && "age" in value;

describe("end to end", () => {
  // Names must be set and ages must be digits. The output has the age as a number.
  const schema = fakeSchema<Input, Output>((input) => {
    if (!isInput(input)) return { issues: [{ message: "Not a profile" }] };
    const issues: StandardSchemaV1.Issue[] = [];
    if (input.name === "") issues.push({ message: "Name required", path: ["name"] });
    if (!/^\d+$/.test(input.age)) issues.push({ message: "Age must be a number", path: [{ key: "age" }] });
    return issues.length > 0 ? { issues } : { value: { name: input.name, age: Number(input.age) } };
  });

  it("defines, writes, blurs, fails a submit, and passes the schema output once fixed", async () => {
    const { plugin } = fakeAdapter({ name: "", age: "" });
    const onSubmit = vi.fn<(value: Output) => string>((value) => `saved ${value.name}`);
    const store = createFormsCore({ plugins: [plugin] }).define({ schema, onSubmit }).createStore();
    const name = store.root.at("name");
    const age = store.root.at("age");

    name.setValue("Ada");
    age.setValue("x");
    age.handleBlur();
    expect(age.peek()).toMatchObject({ errors: [err("Age must be a number")], shownErrors: [err("Age must be a number")] });
    expect(name.peek().errors).toEqual([]);

    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(onSubmit).not.toHaveBeenCalled();

    age.setValue("36");
    expect(age.peek().errors).toEqual([]);
    expect(await store.submit()).toEqual({ status: "succeeded", result: "saved Ada" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ name: "Ada", age: 36 });
  });
});
