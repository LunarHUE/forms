import { afterEach, describe, expect, it, vi } from "vitest";
import type { FormError } from "../errors.js";
import { createFormsCore } from "../forms-core.js";
import { dirty } from "../plugins/dirty.js";
import { rebase } from "../plugins/rebase.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import { definePlugin } from "../plugins.js";
import type { SchemaAdapter } from "../schema-adapter.js";
import { fieldValidators } from "../index.js";

interface Contact {
  name: string;
  rows: { title: string }[];
}

const contact = (): Contact => ({ name: "", rows: [{ title: "a" }] });
const err = (message: string): FormError => ({ message });
const required = (value: string) => (value === "" ? err("Required") : undefined);

/** A store with no plugins. */
const bare = (onSubmit?: (value: Contact) => unknown) =>
  createFormsCore()
    .define({ defaultValues: contact(), ...(onSubmit && { onSubmit }) })
    .createStore();

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a form with no plugins", () => {
  it("resolves validate() as valid when nothing validates, on the form and on a field", async () => {
    const store = bare();
    expect(await store.validate()).toBe(true);
    expect(await store.root.at("name").validate()).toBe(true);
    expect(store.getFormSnapshot()).toMatchObject({ valid: true, validating: false });
  });

  it("submits the form value, and onSubmit gets it as the output", async () => {
    const onSubmit = vi.fn<(value: Contact) => string>(() => "saved");
    const store = bare(onSubmit);
    store.root.at("name").setValue("Ada");
    expect(await store.submit()).toEqual({ status: "succeeded", result: "saved" });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ name: "Ada", rows: [{ title: "a" }] });
    expect(store.getFormSnapshot().submitCount).toBe(1);
  });

  it("shows errors from setErrors on their fields, and keeps them as user errors", async () => {
    const store = bare();
    store.setErrors({ form: err("Try again"), fields: { name: err("Taken"), "rows.0.title": err("Too short") } });
    const [row] = store.root.at("rows").peek().keys;
    expect(store.getSnapshot([]).errors).toEqual([err("Try again")]);
    expect(store.getSnapshot(["name"])).toMatchObject({ errors: [err("Taken")], userErrors: [err("Taken")], invalid: true });
    expect(store.getSnapshot(["rows", row ?? "", "title"]).errors).toEqual([err("Too short")]);
    // A user edit clears the field's own.
    store.root.at("name").setValue("Ada");
    expect(store.getSnapshot(["name"]).errors).toEqual([]);
    // User errors never block a submit. The submit clears them.
    expect(await store.submit()).toMatchObject({ status: "succeeded" });
    expect(store.getSnapshot([]).errors).toEqual([]);
  });

  it("keeps errors set inside onSubmit, as server errors are", async () => {
    const store = createFormsCore()
      .define({
        defaultValues: contact(),
        onSubmit: (_value, ctx) => {
          ctx.store.setErrors({ fields: { name: err("Taken") } });
          throw new Error("conflict");
        },
      })
      .createStore();
    expect(await store.submit()).toMatchObject({ status: "failed" });
    expect(store.getSnapshot(["name"]).errors).toEqual([err("Taken")]);
  });

  it("writes, blurs, resets and rebases", () => {
    const store = createFormsCore({ plugins: [rebase(), dirty()] }).define({ defaultValues: contact() }).createStore();
    const name = store.root.at("name");
    name.setValue("Ada");
    name.handleBlur();
    expect(name.peek()).toMatchObject({ value: "Ada", touched: true, dirty: true });
    expect(store.plugins.rebase(store.root, { name: "Bob", rows: [{ title: "a" }] }, () => "take").taken).toEqual([["name"]]);
    store.reset();
    expect(name.peek()).toMatchObject({ value: "Bob", touched: false, dirty: false });
  });

  it("runs a definition's validators, blocks the submit and lets a fixed value through", async () => {
    const onSubmit = vi.fn<(value: Contact) => void>();
    const store = createFormsCore()
      .define({ defaultValues: contact(), validate: { fields: fieldValidators({ name: required }) }, onSubmit })
      .createStore();
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(store.getSnapshot(["name"])).toMatchObject({ errors: [err("Required")], invalid: true });
    store.root.at("name").setValue("Ada");
    expect(store.getSnapshot(["name"]).errors).toEqual([]);
    expect(await store.submit()).toMatchObject({ status: "succeeded" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("takes validators added to a field, and field.validate() runs them", async () => {
    const store = bare();
    const name = store.root.at("name");
    const stop = name.registerValidator(required);
    expect(await name.validate()).toBe(false);
    expect(name.peek()).toMatchObject({ errors: [err("Required")], invalid: true });
    expect(await store.validate()).toBe(false);
    stop();
    expect(name.peek().errors).toEqual([]);
    expect(await store.validate()).toBe(true);
    const off = store.registerValidator(["name"], (value) => (value === "" ? err("Required") : undefined));
    expect(await store.validate()).toBe(false);
    off();
  });

  it("validates in production too", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const store = createFormsCore()
      .define({ defaultValues: contact(), validate: { fields: fieldValidators({ name: required }) } })
      .createStore();
    expect(await store.root.at("name").validate()).toBe(false);
    expect(store.getSnapshot(["name"]).errors).toEqual([err("Required")]);
  });
});

describe("plugins on the definition", () => {
  it("bring the schema defaults for that form alone", () => {
    const forms = createFormsCore();
    const adapter: SchemaAdapter<StandardSchemaV1<{ city: string }>> = {
      vendor: "city",
      defaultValue: () => ({ city: "Paris" }),
      itemValue: () => undefined,
    };
    const vendor = definePlugin({ name: "city", schema: adapter })();
    const schema: StandardSchemaV1<{ city: string }> = {
      // The store passes the form value, which has this shape.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      "~standard": { version: 1, vendor: "city", validate: (value) => ({ value: value as { city: string } }) },
    };
    expect(forms.define({ schema, plugins: [vendor] }).createStore().root.peek().value).toEqual({ city: "Paris" });
  });
});

describe("a form with a Standard Schema no plugin accepts", () => {
  interface Signup {
    name: string;
    age: string;
  }
  // A hand-written Standard Schema, as arktype or any library without a schema plugin gives one.
  const signup: StandardSchemaV1<Signup, { name: string; age: number }> = {
    "~standard": {
      version: 1,
      vendor: "hand-written",
      validate: (value) => {
        // The store passes the form value, which is a `Signup`.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const { name, age } = value as Signup;
        const issues: StandardSchemaV1.Issue[] = [];
        if (name === "") issues.push({ message: "Name required", path: ["name"] });
        if (!/^\d+$/.test(age)) issues.push({ message: "Digits only", path: [{ key: "age" }] });
        return issues.length > 0 ? { issues } : { value: { name, age: Number(age) } };
      },
    },
  };

  it("starts from defaultValues, validates on submit, places issues on fields and passes the output", async () => {
    const onSubmit = vi.fn<(value: { name: string; age: number }) => void>();
    const store = createFormsCore()
      .define({ schema: signup, defaultValues: { name: "", age: "x" }, onSubmit })
      .createStore();
    expect(store.root.peek().value).toEqual({ name: "", age: "x" });
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(store.getSnapshot(["name"])).toMatchObject({ errors: [err("Name required")], invalid: true });
    expect(store.getSnapshot(["age"]).errors).toEqual([err("Digits only")]);
    expect(onSubmit).not.toHaveBeenCalled();
    store.root.at("name").setValue("Ada");
    store.root.at("age").setValue("36");
    expect(await store.submit()).toMatchObject({ status: "succeeded" });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ name: "Ada", age: 36 });
  });
});

describe("a form with a schema plugin", () => {
  it("validates with the schema, passes its output to onSubmit, and runs function validators too", async () => {
    const schema: StandardSchemaV1<{ age: string }, { age: number }> = {
      "~standard": {
        version: 1,
        vendor: "digits",
        validate: (value) => {
          // The store passes the form value, which has this shape.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          const { age } = value as { age: string };
          return /^\d+$/.test(age) ? { value: { age: Number(age) } } : { issues: [{ message: "Digits", path: ["age"] }] };
        },
      },
    };
    const adapter: SchemaAdapter<typeof schema> = { vendor: "digits", defaultValue: () => ({ age: "" }), itemValue: () => undefined };
    const digits = definePlugin({ name: "digits", schema: adapter })();
    const onSubmit = vi.fn<(value: { age: number }) => void>();
    const store = createFormsCore({ plugins: [digits] })
      .define({ schema, validate: { fields: fieldValidators({ age: (value) => (value === "0" ? err("Not zero") : undefined) }) }, onSubmit })
      .createStore();
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(store.getSnapshot(["age"]).errors).toEqual([err("Digits")]);
    store.root.at("age").setValue("0");
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(store.getSnapshot(["age"]).errors).toEqual([err("Not zero")]);
    store.root.at("age").setValue("36");
    expect(await store.submit()).toMatchObject({ status: "succeeded" });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ age: 36 });
  });
});
