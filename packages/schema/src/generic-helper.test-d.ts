// The snippets in docs/plugins.md under "TS2353 from `define` in a function
// generic over the schema". Keep the two in step.
import { createFormsCore, type FormError, type FormStore, type StandardSchemaV1 } from "@lunarhue/forms-core";
import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { zod } from "./zod.js";

const forms = createFormsCore({ plugins: [zod()] });

// I is the schema's input and O its output.
export function makeForm<I extends object, O>(schema: z.ZodType<O, I>, onSubmit: (value: O) => void) {
  return forms.define({ schema, onSubmit });
}

// Any Standard Schema. No schema plugin accepts this type, so it needs defaultValues.
export function makeStandard<V extends object>(schema: StandardSchemaV1<V>, defaultValues: V) {
  return forms.define({ schema, defaultValues });
}

// The form that fails. When this starts to compile, the docs section can go.
export function makeFromSchema<S extends z.ZodObject>(schema: S) {
  // @ts-expect-error: with S unresolved, the config matches no branch of define
  return forms.define({ schema });
}

describe("a helper that defines a form from a schema", () => {
  it("types the form when the helper is generic over the values", () => {
    const user = z.object({ name: z.string(), age: z.number(), joined: z.string().transform(Date.parse) });
    const store = makeForm(user, (value) => {
      expectTypeOf(value).toEqualTypeOf<{ name: string; age: number; joined: number }>();
    }).createStore();
    // The zod plugin still applies, so the number starts undefined.
    expectTypeOf(store).toEqualTypeOf<FormStore<{ name: string; age: number | undefined; joined: string }, FormError, undefined, void>>();
  });

  it("types a Standard Schema form from its values", () => {
    const other: StandardSchemaV1<{ name: string }> = z.object({ name: z.string() });
    const store = makeStandard(other, { name: "Ada" }).createStore();
    expectTypeOf(store).toEqualTypeOf<FormStore<{ name: string }>>();
  });

  it("fails when the helper is generic over the schema type", () => {
    expectTypeOf(makeFromSchema).toBeFunction();
  });
});
