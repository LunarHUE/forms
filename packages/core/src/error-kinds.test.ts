import { describe, expect, expectTypeOf, it } from "vitest";
import { errorsByKind } from "./error-kinds.js";
import type { FormError, MapError } from "./errors.js";
import { arrays } from "./plugins/arrays.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import type { ErrorsByKind } from "./store.js";
import { createFormStore, type FormStoreOptions } from "./store/form-store.js";
import { fieldValidators, formValidator } from "./index.js";

interface Value {
  name: string;
  rows: { title: string }[];
}

const initial: Value = { name: "", rows: [{ title: "" }] };

const make = (options: Omit<FormStoreOptions<Value>, "id" | "initial"> = {}) =>
  createFormStore<Value>({ id: "f", initial, plugins: [arrays()], ...options });

const err = (message: string): FormError => ({ message });

/** A Standard Schema whose result is fixed. */
const failing = (...issues: StandardSchemaV1.Issue[]): StandardSchemaV1<Value> => ({
  "~standard": { version: 1, vendor: "fake", validate: () => ({ issues }) },
});

const tagged: MapError<string> = (raw) => raw.message;

describe("errorsByKind", () => {
  it("groups a field's validation errors by schema, form and field validators, leaving out setErrors", async () => {
    const store = make({
      schema: failing({ message: "Schema", path: ["name"] }),
      validate: {
        form: formValidator(() => ({ fields: { name: err("Form") } })),
        fields: fieldValidators({ name: () => err("Field") }),
      },
    });
    const name = store.root.at("name");
    store.registerValidator(["name"], () => err("Registered"));
    await store.validate();
    name.setErrors(err("Taken"));
    const groups = errorsByKind(name);
    expect(groups).toEqual({
      schema: [err("Schema")],
      form: [err("Form")],
      field: [err("Field"), err("Registered")],
    });
    // Together, in this order, they are the validation part of `errors`.
    const { errors, userErrors } = store.getSnapshot(["name"]);
    expect([...groups.schema, ...groups.form, ...groups.field, ...userErrors]).toEqual(errors);
  });

  it("returns empty groups for a valid field and for a path with no field", async () => {
    const store = make({ validate: { fields: fieldValidators({ name: () => undefined }) } });
    await store.validate();
    const empty = { schema: [], form: [], field: [] };
    expect(errorsByKind(store.root.at("name"))).toEqual(empty);
    expect(errorsByKind({ store, path: ["missing", "deep"] })).toEqual(empty);
  });

  it("puts a thrown validator's error under its kind, and a form validator's form errors on the root", async () => {
    const store = make({
      validate: {
        form: formValidator(() => ({ form: err("Whole form") })),
        fields: fieldValidators({
          rows: [
            {
              title: () => {
                throw new Error("Boom");
              },
            },
          ],
        }),
      },
    });
    await store.validate();
    expect(errorsByKind(store.root).form).toEqual([err("Whole form")]);
    const title = store.root.at("rows").item(store.getSnapshot(["rows"]).keys?.[0] ?? "").at("title");
    expect(errorsByKind(title)).toEqual({ schema: [], form: [], field: [err("Boom")] });
  });

  it("drops a registered validator's errors once it is removed", async () => {
    const store = make({ validate: { fields: fieldValidators({ name: () => err("Field") }) } });
    const remove = store.registerValidator(["name"], () => err("Registered"));
    await store.validate();
    expect(errorsByKind(store.root.at("name")).field).toEqual([err("Field"), err("Registered")]);
    remove();
    expect(errorsByKind(store.root.at("name")).field).toEqual([err("Field")]);
  });

  it("orders a kind's errors by registration, not by which validator ran last", async () => {
    let first: FormError | undefined;
    const store = make({ validate: { fields: fieldValidators({ name: () => first }) } });
    store.registerValidator(["name"], () => err("Second"));
    await store.validate();
    first = err("First");
    await store.root.at("name").validate();
    expect(errorsByKind(store.root.at("name")).field).toEqual([err("First"), err("Second")]);
    expect(store.getSnapshot(["name"]).errors).toEqual([err("First"), err("Second")]);
  });

  it("types the groups with the store's error type", () => {
    const store = createFormStore<Value, string>({ id: "f", initial, mapError: tagged });
    expectTypeOf(errorsByKind(store.root.at("name"))).toEqualTypeOf<ErrorsByKind<string>>();
  });
});
