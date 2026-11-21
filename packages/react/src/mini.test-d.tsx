import { describe, expectTypeOf, it } from "vitest";
import type * as full from "./index.js";
import { createForms, type FieldApi, type FormOf, type FormStore, type NamedAnyFieldHandle, type Parts, perField, transform, useForm } from "./mini.js";
import { definePlugin, history, part, transform as fullTransform } from "./plugins.js";

const forms = createForms();
const search = forms.define({ defaultValues: { q: "", page: 1, filters: { brand: "" } } });
type Search = FormOf<typeof search>;
declare const form: Search;

describe("mini's types are full's, narrowed", () => {
  it("takes a full field object where a mini one is asked for, and not the reverse", () => {
    expectTypeOf<full.FieldApi<string>>().toExtend<FieldApi<string>>();
    expectTypeOf<FieldApi<string>>().not.toExtend<full.FieldApi<string>>();
    expectTypeOf<full.FieldApi<number | undefined>>().toExtend<FieldApi<number | undefined>>();
  });

  it("takes a full store where a mini one is asked for", () => {
    expectTypeOf<full.FormStore<{ q: string }>>().toExtend<FormStore<{ q: string }>>();
    expectTypeOf<full.NamedAnyFieldHandle>().toExtend<NamedAnyFieldHandle>();
  });

  it("accepts perField in full's createForms", () => {
    expectTypeOf<full.FormsOptions>().toHaveProperty("subscribe");
    expectTypeOf(perField()).toExtend<NonNullable<full.FormsOptions["subscribe"]>>();
  });
});

describe("form.Field", () => {
  it("takes dotted names of fields that aren't objects", () => {
    <form.Field name="q">{(field) => expectTypeOf(field.value).toEqualTypeOf<string>()}</form.Field>;
    <form.Field name="page">{(field) => expectTypeOf(field.value).toEqualTypeOf<number>()}</form.Field>;
    <form.Field name="filters.brand">{(field) => expectTypeOf(field.value).toEqualTypeOf<string>()}</form.Field>;
    // @ts-expect-error: no field is named query
    <form.Field name="query">{() => null}</form.Field>;
    // @ts-expect-error: mini binds no object fields
    <form.Field name="filters">{() => null}</form.Field>;
  });

  it("gives useForm's form the definition's types", () => {
    expectTypeOf(useForm(search)).toEqualTypeOf<Search>();
  });
});

describe("define", () => {
  it("takes mini's parts where their value fits", () => {
    const Trimmed = forms.fieldset<string>(transform((value) => value.trim()));
    expectTypeOf(forms.define({ defaultValues: { q: "" } }, Trimmed.at("q"))).toEqualTypeOf(forms.define({ defaultValues: { q: "" } }));
    // @ts-expect-error: q holds a string, and the part fits numbers
    forms.define({ defaultValues: { q: "" } }, forms.fieldset<number>(transform((value) => value + 1)).at("q"));
  });

  it("rejects full's plugins and parts", () => {
    expectTypeOf(history()).not.toExtend<Parts<{ q: string }>>();
    // @ts-expect-error: mini has no plugins
    forms.define({ defaultValues: { q: "" } }, history());
    const limit = definePlugin({ name: "limit", part: (_ctx, max: number) => ({ beforeWrite: (write) => (typeof write.value === "string" ? write.value.slice(0, max) : write.value) }) });
    // @ts-expect-error: a part of a plugin needs the full entry
    forms.define({ defaultValues: { q: "" } }, part(limit, 10));
    // @ts-expect-error: full's parts run on full's store only
    forms.define({ defaultValues: { q: "" } }, fullTransform<{ q: string }>((value) => value));
  });
});
