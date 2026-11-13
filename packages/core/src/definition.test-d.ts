import { describe, expectTypeOf, it } from "vitest";
import type {
  CreateFormsCore,
  DeepPartial,
  DefinedValue,
  FieldSnapshot,
  Flags,
  FormDefinition,
  FormError,
  FormStore,
  HasAdapter,
  ObjectHandle,
  PlainDefinition,
  SchemaAdapter,
  SchemaDefinition,
  StandardSchemaV1,
  Submission,
} from "./index.js";

// A schema type an adapter supports, and one no adapter supports.
interface FakeSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly fake: true;
}
interface OtherSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly other: true;
}

declare const createFormsCore: CreateFormsCore;
declare const fakeAdapter: SchemaAdapter<FakeSchema<unknown>>;

interface User {
  name: string;
  age: number;
  address: { city: string; zip: string };
}

declare const userSchema: FakeSchema<User>;
declare const otherUserSchema: OtherSchema<User>;
declare const parsedSchema: FakeSchema<{ age: string }, { age: number }>;

const core = createFormsCore({ schemas: [fakeAdapter] });

type Adapters = readonly [typeof fakeAdapter];
type DefaultsOf<S extends StandardSchemaV1, A extends readonly SchemaAdapter<never>[] = Adapters> = SchemaDefinition<
  S,
  A,
  FormError,
  undefined,
  unknown
>["defaultValues"];

type StoreOf<D> = D extends FormDefinition<infer V, infer E, infer I, infer R, infer _O> ? FormStore<V, E, I, R> : never;

describe("defaults case 1: schema with a registered adapter", () => {
  it("takes no defaultValues", () => {
    const form = core.define({ schema: userSchema });
    expectTypeOf<StoreOf<typeof form>>().toEqualTypeOf<FormStore<User>>();
    expectTypeOf(form.createStore().root).toEqualTypeOf<ObjectHandle<User>>();
  });

  it("takes a deep partial", () => {
    const form = core.define({ schema: userSchema, defaultValues: { address: { city: "Paris" } } });
    expectTypeOf(form.createStore().root).toEqualTypeOf<ObjectHandle<User>>();
    expectTypeOf<DefaultsOf<FakeSchema<User>>>().toEqualTypeOf<DeepPartial<User> | undefined>();
  });

  it("rejects defaults of the wrong type", () => {
    // @ts-expect-error: age is a number
    core.define({ schema: userSchema, defaultValues: { age: "1" } });
    expectTypeOf<DeepPartial<User>["age"]>().toEqualTypeOf<number | undefined>();
  });

  it("passes the schema output to onSubmit", () => {
    core.define({
      schema: parsedSchema,
      onSubmit: (value, ctx) => {
        expectTypeOf(value).toEqualTypeOf<{ age: number }>();
        expectTypeOf(ctx.input).toEqualTypeOf<{ readonly age: string }>();
      },
    });
  });
});

describe("defaults case 2: schema without an adapter", () => {
  it("requires complete defaultValues", () => {
    const form = core.define({
      schema: otherUserSchema,
      defaultValues: { name: "", age: 0, address: { city: "", zip: "" } },
    });
    expectTypeOf<StoreOf<typeof form>>().toEqualTypeOf<FormStore<User>>();
  });

  it("rejects missing defaultValues", () => {
    // @ts-expect-error: no adapter supports OtherSchema, so defaultValues is required
    core.define({ schema: otherUserSchema });
    expectTypeOf<DefaultsOf<OtherSchema<User>>>().toEqualTypeOf<User>();
  });

  it("rejects partial defaultValues", () => {
    // @ts-expect-error: age and address are missing
    core.define({ schema: otherUserSchema, defaultValues: { name: "" } });
    expectTypeOf<{ name: string }>().not.toExtend<DefaultsOf<OtherSchema<User>>>();
  });

  it("treats every schema as unsupported when no adapters are registered", () => {
    const bare = createFormsCore();
    // @ts-expect-error: no adapters, so defaultValues is required
    bare.define({ schema: userSchema });
    expectTypeOf<HasAdapter<FakeSchema<User>, []>>().toEqualTypeOf<false>();
    expectTypeOf<HasAdapter<FakeSchema<User>, Adapters>>().toEqualTypeOf<true>();
  });
});

describe("defaults case 3: no schema", () => {
  it("infers V from defaultValues", () => {
    const form = core.define({ defaultValues: { name: "", tags: [] as string[] } });
    expectTypeOf<StoreOf<typeof form>>().toEqualTypeOf<
      FormStore<{ name: string; tags: string[] }>
    >();
  });

  it("rejects missing defaultValues", () => {
    // @ts-expect-error: without a schema defaultValues is required
    core.define({ onSubmit: () => {} });
    expectTypeOf<PlainDefinition<{ a: number }, FormError, undefined, unknown>["defaultValues"]>().toEqualTypeOf<{
      a: number;
    }>();
  });

  it("accepts an explicit V", () => {
    const form = core.define<{ name: string; nick?: string }>({ defaultValues: { name: "" } });
    expectTypeOf<StoreOf<typeof form>>().toEqualTypeOf<
      FormStore<{ name: string; nick?: string }>
    >();
  });

  it("checks defaultValues against an explicit V", () => {
    // @ts-expect-error: name is a string
    core.define<{ name: string }>({ defaultValues: { name: 1 } });
    expectTypeOf<DefinedValue<{ name: string }, never>>().toEqualTypeOf<{ name: string }>();
  });

  it("types onSubmit's value from defaultValues", () => {
    core.define({
      defaultValues: { name: "" },
      onSubmit: (value) => {
        expectTypeOf(value).toEqualTypeOf<{ name: string }>();
      },
    });
  });
});

describe("the function form", () => {
  it("takes per-store options", () => {
    const form = core.define((options: { name: string }) => ({ defaultValues: { name: options.name } }));
    const store = form.createStore({ name: "Ada" }, { id: "profile" });
    expectTypeOf(store).toEqualTypeOf<FormStore<{ name: string }>>();
    // @ts-expect-error: options are required
    form.createStore();
  });

  it("works with a schema", () => {
    const form = core.define((options: { id: string }) => ({ schema: userSchema, onSubmit: () => options.id }));
    expectTypeOf(form.createStore({ id: "x" })).toEqualTypeOf<FormStore<User, FormError, undefined, string>>();
  });

  it("a plain config takes no options", () => {
    const form = core.define({ defaultValues: { a: 1 } });
    expectTypeOf(form.createStore()).toEqualTypeOf<FormStore<{ a: number }>>();
    expectTypeOf(form.createStore(undefined, { id: "a" }).id).toEqualTypeOf<string>();
  });
});

describe("intent and result", () => {
  it("infers R from what onSubmit returns", () => {
    const form = core.define({
      defaultValues: { name: "" },
      onSubmit: async (value) => ({ saved: value.name }),
    });
    const store = form.createStore();
    expectTypeOf(store.submit()).toEqualTypeOf<Promise<Submission<undefined, { saved: string }>>>();
    expectTypeOf(store.peek().submission).toEqualTypeOf<Submission<undefined, { saved: string }>>();
  });

  it("infers I from the annotation on ctx.intent, and then requires it", () => {
    const form = core.define({
      defaultValues: { name: "" },
      onSubmit: (_value, ctx: { intent: "save" | "publish" }) => ctx.intent,
    });
    const store = form.createStore();
    expectTypeOf(store.submit("save")).toEqualTypeOf<Promise<Submission<"save" | "publish", "save" | "publish">>>();
    // @ts-expect-error: the intent is required
    void store.submit();
    // @ts-expect-error: "draft" is not an intent
    void store.submit("draft");
  });

  it("allows submit() when undefined is a valid intent", () => {
    const form = core.define({
      defaultValues: { name: "" },
      onSubmit: (_value, ctx: { intent: "save" | undefined }) => ctx.intent,
    });
    const store = form.createStore();
    expectTypeOf(store.submit()).toEqualTypeOf<Promise<Submission<"save" | undefined, "save" | undefined>>>();
    void store.submit("save");
  });

  it("defaults I to undefined and R to unknown with no onSubmit", () => {
    const store = core.define({ defaultValues: { a: 1 } }).createStore();
    expectTypeOf(store).toEqualTypeOf<FormStore<{ a: number }>>();
    void store.submit();
  });
});

describe("the error type", () => {
  it("defaults to FormError", () => {
    const store = createFormsCore().define({ defaultValues: { a: "" } }).createStore();
    expectTypeOf(store.getSnapshot(["a"]).errors).toEqualTypeOf<readonly FormError[]>();
  });

  it("comes from mapError and flows to snapshots, validators and setErrors", () => {
    interface AppError {
      readonly key: string;
    }
    const app = createFormsCore({ mapError: (raw): AppError => ({ key: raw.message }) });
    const form = app.define({
      defaultValues: { name: "" },
      validate: {
        fields: { name: (value) => (value ? undefined : { key: "required" }) },
        form: () => ({ fields: { name: { key: "taken" } } }),
      },
    });
    const store = form.createStore();
    expectTypeOf(store.root.at("name").peek()).toEqualTypeOf<FieldSnapshot<string, AppError>>();
    expectTypeOf(store.getSnapshot([]).shownErrors).toEqualTypeOf<readonly AppError[]>();
    store.setErrors({ form: { key: "x" }, fields: { name: [{ key: "y" }] } });
    store.root.at("name").setErrors({ key: "z" });
    // @ts-expect-error: AppError has no message
    store.setErrors({ form: { message: "x" } });

    // @ts-expect-error: a validator must return AppError
    app.define({ defaultValues: { name: "" }, validate: { fields: { name: () => ({ message: "no" }) } } });
  });

  it("allows a plain string error type", () => {
    const app = createFormsCore({ mapError: (raw) => raw.message });
    const store = app.define({ defaultValues: { a: "" } }).createStore();
    expectTypeOf(store.peek().valid).toEqualTypeOf<boolean>();
    expectTypeOf(store.getSnapshot(["a"]).errors).toEqualTypeOf<readonly string[]>();
  });
});

describe("other definition settings", () => {
  it("takes flags shaped like the value", () => {
    core.define({
      defaultValues: { name: "", address: { city: "" }, rows: [{ title: "" }] },
      disabled: { address: { city: true }, rows: [{ title: true }] },
      readOnly: true,
    });
    expectTypeOf<{ nope: true }>().not.toExtend<Flags<{ name: string }>>();
    // @ts-expect-error: no field named nope
    core.define({ defaultValues: { name: "" }, disabled: { nope: true } });
  });

  it("gives onSubmit a store, signal and input", () => {
    core.define({
      defaultValues: { name: "" },
      onSubmit: (value, ctx) => {
        expectTypeOf(ctx.store.root).toEqualTypeOf<ObjectHandle<{ name: string }>>();
        expectTypeOf(ctx.input).toEqualTypeOf<{ readonly name: string }>();
        expectTypeOf(ctx.signal.aborted).toEqualTypeOf<boolean>();
        return value;
      },
    });
  });
});
