import { describe, expectTypeOf, it } from "vitest";
import type {
  CreateFormsCore,
  DeepPartial,
  DefinedValue,
  Draft,
  FieldSnapshot,
  Flags,
  FormDefinition,
  FormError,
  FormStore,
  HasSchemaPlugin,
  HasValidation,
  ItemHandle,
  LeafHandle,
  ObjectHandle,
  PlainDefinition,
  SchemaDefinition,
  SchemaPlugin,
  StandardSchemaV1,
  Submission,
  ValidationPlugin,
} from "./index.js";

// A schema type a plugin accepts, and one no plugin accepts.
interface FakeSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly fake: true;
}
interface OtherSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly other: true;
}

declare const createFormsCore: CreateFormsCore;
declare const fakePlugin: SchemaPlugin<FakeSchema<unknown>>;
declare const validation: () => ValidationPlugin;

interface User {
  name: string;
  age: number;
  address: { city: string; zip: string };
}

// User as the schema plugin's defaults leave it: the number starts undefined.
interface DraftUser {
  name: string;
  age: number | undefined;
  address: { city: string; zip: string };
}

declare const userSchema: FakeSchema<User>;
declare const otherUserSchema: OtherSchema<User>;
declare const rowsSchema: FakeSchema<{ rows: { title: string; qty: number }[] }>;
declare const parsedSchema: FakeSchema<{ age: string }, { age: number }>;

const core = createFormsCore({ plugins: [fakePlugin] });

type Installed = readonly [typeof fakePlugin];
type DefaultsOf<S extends StandardSchemaV1> = SchemaDefinition<S, Installed, FormError, undefined, unknown>["defaultValues"];

type StoreOf<D> = D extends FormDefinition<infer V, infer E, infer I, infer R, infer _O, infer _P> ? FormStore<V, E, I, R> : never;

describe("defaults case 1: schema with a schema plugin", () => {
  it("takes no defaultValues and types the value as a draft", () => {
    const form = core.define({ schema: userSchema });
    expectTypeOf<StoreOf<typeof form>>().toEqualTypeOf<FormStore<DraftUser>>();
    expectTypeOf<StoreOf<typeof form>>().toEqualTypeOf<FormStore<Draft<User>>>();
    expectTypeOf(form.createStore().root).toEqualTypeOf<ObjectHandle<DraftUser>>();
    expectTypeOf<DefinedValue<never, FakeSchema<User>, Installed>>().toEqualTypeOf<Draft<User>>();
  });

  it("takes a deep partial of the input, not of the draft", () => {
    const form = core.define({ schema: userSchema, defaultValues: { address: { city: "Paris" } } });
    expectTypeOf(form.createStore().root).toEqualTypeOf<ObjectHandle<DraftUser>>();
    expectTypeOf<DefaultsOf<FakeSchema<User>>>().toEqualTypeOf<DeepPartial<User> | undefined>();
  });

  it("gives a draft leaf a handle that takes undefined", () => {
    const store = core.define({ schema: userSchema }).createStore();
    const age = store.root.at("age");
    expectTypeOf(age).toEqualTypeOf<LeafHandle<number | undefined>>();
    age.setValue(undefined);
    age.setValue((previous) => (previous ?? 0) + 1);
    expectTypeOf(store.root.at("name")).toEqualTypeOf<LeafHandle<string>>();
    expectTypeOf(age.peek().value).toEqualTypeOf<number | undefined>();
  });

  it("drafts array items, so push takes a draft item", () => {
    const store = core.define({ schema: rowsSchema }).createStore();
    const rows = store.root.at("rows");
    rows.push();
    rows.push({ title: "", qty: undefined });
    expectTypeOf(rows.item("k")).toEqualTypeOf<ItemHandle<{ title: string; qty: number | undefined }>>();
    expectTypeOf(rows.item("k").at("qty")).toEqualTypeOf<LeafHandle<number | undefined>>();
  });

  it("types validators, flags and ctx.input with the draft, and onSubmit's value with the output", () => {
    core.define({
      schema: userSchema,
      validate: {
        fields: {
          age: (value) => {
            expectTypeOf(value).toEqualTypeOf<number | undefined>();
            return value === undefined ? { message: "required" } : undefined;
          },
        },
        form: (value) => {
          expectTypeOf(value).toEqualTypeOf<DraftUser>();
          return undefined;
        },
      },
      disabled: { age: true, address: { city: true } },
      onSubmit: (value, ctx) => {
        expectTypeOf(value).toEqualTypeOf<User>();
        expectTypeOf(ctx.input.age).toEqualTypeOf<number | undefined>();
        expectTypeOf(ctx.store).toEqualTypeOf<FormStore<DraftUser>>();
      },
    });
    // The whole schema is still a valid form validator for the draft.
    core.define({ schema: userSchema, validate: { form: userSchema } });
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

describe("defaults case 1: from the definition's own plugins", () => {
  it("accepts a schema whose plugin the definition installs", () => {
    const form = createFormsCore().define({ schema: userSchema, plugins: [fakePlugin] });
    expectTypeOf<StoreOf<typeof form>>().toEqualTypeOf<FormStore<DraftUser>>();
    createFormsCore().define({
      schema: userSchema,
      plugins: [fakePlugin],
      validate: {
        fields: {
          age: (value) => {
            expectTypeOf(value).toEqualTypeOf<number | undefined>();
            return undefined;
          },
        },
      },
    });
  });
});

describe("defaults case 2: a Standard Schema no plugin accepts, with the runner", () => {
  const withRunner = createFormsCore({ plugins: [validation()] });
  const complete: User = { name: "", age: 0, address: { city: "", zip: "" } };

  it("types the value from the schema's input and requires complete defaultValues", () => {
    const form = withRunner.define({ schema: userSchema, defaultValues: complete });
    expectTypeOf<StoreOf<typeof form>>().toEqualTypeOf<FormStore<User>>();
    const other = core.define({ schema: otherUserSchema, defaultValues: complete });
    expectTypeOf<StoreOf<typeof other>>().toEqualTypeOf<FormStore<User>>();
    expectTypeOf<DefaultsOf<OtherSchema<User>>>().toEqualTypeOf<User>();
    expectTypeOf<HasSchemaPlugin<OtherSchema<User>, Installed>>().toEqualTypeOf<false>();
    expectTypeOf<HasSchemaPlugin<FakeSchema<User>, Installed>>().toEqualTypeOf<true>();
  });

  it("rejects missing or partial defaultValues", () => {
    // @ts-expect-error: no schema plugin accepts OtherSchema, so defaultValues is required
    core.define({ schema: otherUserSchema });
    // @ts-expect-error: age and address are missing
    withRunner.define({ schema: userSchema, defaultValues: { name: "" } });
    expectTypeOf<{ name: string }>().not.toExtend<DefaultsOf<OtherSchema<User>>>();
  });

  it("passes the schema output to onSubmit", () => {
    withRunner.define({
      schema: otherUserSchema,
      defaultValues: complete,
      onSubmit: (value) => {
        expectTypeOf(value).toEqualTypeOf<User>();
      },
    });
  });
});

describe("a schema with no validation runner", () => {
  it("is rejected, with a message that says what to install", () => {
    // @ts-expect-error: no plugin brings the runner that runs the schema
    createFormsCore().define({ schema: userSchema, defaultValues: { name: "", age: 0, address: { city: "", zip: "" } } });
    expectTypeOf<HasSchemaPlugin<FakeSchema<User>, []>>().toEqualTypeOf<false>();
  });

  it("names what to install in the schema's type", () => {
    type Bare = SchemaDefinition<FakeSchema<User>, [], FormError, undefined, unknown>["schema"];
    expectTypeOf<Bare>().toEqualTypeOf<
      FakeSchema<User> & {
        readonly "Add validation() or a schema plugin such as valibot() to plugins to use schema": never;
      }
    >();
  });
});

describe("the validation runner", () => {
  const validate = { fields: { name: (value: string) => (value ? undefined : { message: "Required" }) } };

  it("is needed for validate", () => {
    // @ts-expect-error: no plugin brings the runner
    createFormsCore().define({ defaultValues: { name: "" }, validate });
    createFormsCore({ plugins: [validation()] }).define({ defaultValues: { name: "" }, validate });
    expectTypeOf<HasValidation<[]>>().toEqualTypeOf<false>();
    expectTypeOf<HasValidation<readonly [ValidationPlugin]>>().toEqualTypeOf<true>();
  });

  it("comes with every schema plugin", () => {
    core.define({ defaultValues: { name: "" }, validate });
    expectTypeOf<HasValidation<Installed>>().toEqualTypeOf<true>();
  });

  it("names the plugin to install in the type of validate", () => {
    type Bare = NonNullable<PlainDefinition<{ name: string }, FormError, undefined, unknown>["validate"]>;
    expectTypeOf<Bare>().toExtend<{
      readonly "Add validation() or a schema plugin such as valibot() to plugins to use validate": never;
    }>();
  });

  it("keeps the validators typed when it is missing, so only validate is reported", () => {
    createFormsCore().define({
      defaultValues: { name: "" },
      // @ts-expect-error: no plugin brings the runner
      validate: {
        fields: {
          name: (value) => {
            expectTypeOf(value).toEqualTypeOf<string>();
            return undefined;
          },
        },
      },
    });
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

  it("falls back to the default I and R with an explicit V unless they are given too", () => {
    const loose = core.define<{ name: string }>({ defaultValues: { name: "" }, onSubmit: () => "saved" });
    expectTypeOf(loose.createStore()).toEqualTypeOf<FormStore<{ name: string }>>();
    const typed = core.define<{ name: string }, never, void, "save", string>({
      defaultValues: { name: "" },
      onSubmit: (_value, ctx) => ctx.intent,
    });
    expectTypeOf(typed.createStore()).toEqualTypeOf<FormStore<{ name: string }, FormError, "save", string>>();
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
    expectTypeOf(form.createStore({ id: "x" })).toEqualTypeOf<FormStore<DraftUser, FormError, undefined, string>>();
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
    const app = createFormsCore({ plugins: [validation()], mapError: (raw): AppError => ({ key: raw.message }) });
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
