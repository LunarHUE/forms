import { createFormsCore, type FormStore, type HasAdapter, type StandardSchemaV1 } from "@lunarhue/forms-core";
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

  it("still requires defaultValues for a schema of another vendor", () => {
    const core = createFormsCore({ schemas: [valibot()] });
    // @ts-expect-error: no registered adapter supports this schema
    core.define({ schema: other });
    const store = core.define({ schema: other, defaultValues: { name: "" } }).createStore();
    expectTypeOf(store).toEqualTypeOf<FormStore<{ name: string }>>();
  });
});
