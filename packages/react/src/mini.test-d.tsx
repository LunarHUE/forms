import { describe, expectTypeOf, it } from "vitest";
import type * as full from "./index.js";
import { createForms as fullCreateForms, defineField, useForm as fullUseForm } from "./index.js";
import {
  createForms,
  type FieldApi,
  type FormError,
  type FormOf,
  type FormsOptions,
  type FormStore,
  type NamedAnyFieldHandle,
  type Parts,
  perField,
  transform,
  useForm,
} from "./mini.js";
import { definePlugin, dirty, history, part, transform as fullTransform } from "./plugins.js";

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

  it("takes new values on reset, as full's store does", () => {
    form.store.reset({ values: { q: "", page: 2, filters: { brand: "acme" } } });
    form.store.reset({ to: "initial" });
    // @ts-expect-error: values must be a whole Search value
    form.store.reset({ values: { q: "" } });
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

describe("define((options) => config)", () => {
  interface SearchOptions {
    readonly q: string;
  }
  const withOptions = forms.define((options: SearchOptions) => ({ defaultValues: { q: options.q, page: 1 } }));
  const plain = forms.define({ defaultValues: { q: "", page: 1 } });

  it("infers the value type from what the function returns", () => {
    expectTypeOf<FormOf<typeof withOptions>>().toEqualTypeOf<FormOf<typeof plain>>();
    forms.define((options: SearchOptions) => ({
      defaultValues: { q: options.q },
      onSubmit: (value) => expectTypeOf(value).toEqualTypeOf<{ q: string }>(),
    }));
  });

  it("makes useForm and createStore take the options first", () => {
    expectTypeOf(useForm(withOptions, { q: "" })).toEqualTypeOf<FormOf<typeof withOptions>>();
    useForm(withOptions, { q: "" }, { id: "search" });
    withOptions.createStore({ q: "" }, { id: "search" });
    // @ts-expect-error: the options are required
    useForm(withOptions);
    // @ts-expect-error: the options come before the settings
    useForm(withOptions, { id: "search" });
    // @ts-expect-error: q is a string
    useForm(withOptions, { q: 1 });
    // @ts-expect-error: the options are required
    withOptions.createStore();
  });

  it("takes no options for a plain config", () => {
    expectTypeOf(useForm(search, { id: "search" })).toEqualTypeOf<Search>();
    useForm(search);
    search.createStore();
    // @ts-expect-error: a plain config takes no options
    useForm(search, { q: "" }, { id: "search" });
  });

  it("moves to the full entry with the same define and useForm calls", () => {
    const fullWithOptions = fullCreateForms().define((options: SearchOptions) => ({ defaultValues: { q: options.q, page: 1 } }));
    expectTypeOf(fullUseForm(fullWithOptions, { q: "" }, { id: "search" })).toEqualTypeOf<full.FormOf<typeof fullWithOptions>>();
    // @ts-expect-error: full requires the options too
    fullUseForm(fullWithOptions);
  });
});

interface TextFieldProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function TextField({ field, label }: TextFieldProps) {
  return (
    <label>
      {label} {field.text}
    </label>
  );
}

function NumberField(_props: { readonly field: FieldApi<number> }) {
  return null;
}

function WithDirty(_props: { readonly field: FieldApi<string, typeof dirty> }) {
  return null;
}

const fields = { TextField, NumberField };
const signIn = createForms({ fields }).define({ defaultValues: { email: "", age: 0, address: { city: "" } } });
declare const signInForm: FormOf<typeof signIn>;
const fullSignIn = fullCreateForms({ fields }).define({ defaultValues: { email: "", age: 0, address: { city: "" } } });
declare const fullSignInForm: full.FormOf<typeof fullSignIn>;

describe("registered field components", () => {
  it("take the names of fields whose value fits", () => {
    expectTypeOf<Parameters<typeof signInForm.TextField>[0]["name"]>().toEqualTypeOf<"email" | "address.city">();
    <signInForm.TextField name="email" label="Email" />;
    <signInForm.TextField name="address.city" label="City" />;
    <signInForm.NumberField name="age" />;
    // @ts-expect-error: no field is named phone
    <signInForm.TextField name="phone" label="Phone" />;
    // @ts-expect-error: age holds a number
    <signInForm.TextField name="age" label="Age" />;
    // @ts-expect-error: email holds a string
    <signInForm.NumberField name="email" />;
    // @ts-expect-error: address is an object
    <signInForm.TextField name="address" label="Address" />;
  });

  it("take the component's own props, and fill in field", () => {
    expectTypeOf<Parameters<typeof signInForm.TextField>[0]>().toEqualTypeOf<{ readonly label: string } & { readonly name: "email" | "address.city" }>();
    // @ts-expect-error: label is required
    <signInForm.TextField name="email" />;
    // @ts-expect-error: label is a string
    <signInForm.TextField name="email" label={1} />;
    // @ts-expect-error: the bound component fills in field
    <signInForm.TextField name="email" label="Email" field={undefined} />;
  });

  it("aren't on a form whose createForms registers none", () => {
    expectTypeOf<keyof Search>().toEqualTypeOf<"store" | "id" | "formProps" | "submit" | "handleSubmit" | "Form" | "Field" | "State">();
  });

  it("refuse reserved names, components with no field prop, and full-only entries", () => {
    expectTypeOf<FormsOptions<{ submit: typeof TextField }>["fields"]>().toEqualTypeOf<({ submit: typeof TextField } & { readonly submit: never }) | undefined>();
    // @ts-expect-error: Field is the form's own
    createForms({ fields: { Field: TextField } });
    // @ts-expect-error: handleSubmit is the form's own
    createForms({ fields: { handleSubmit: TextField } });
    // @ts-expect-error: root is the full form's own, so the move to full keeps working
    createForms({ fields: { root: TextField } });
    // @ts-expect-error: a component with no field prop
    createForms({ fields: { Label: (_props: { readonly label: string }) => null } });
    // @ts-expect-error: validate is full's bound component's own
    createForms({ fields: { Checked: (_props: { readonly field: FieldApi<string>; readonly validate: string }) => null } });
    // @ts-expect-error: defineField needs the full entry
    createForms({ fields: { Phone: defineField(TextField) } });
    // @ts-expect-error: full's field object has members mini's lacks
    createForms({ fields: { Full: (_props: { readonly field: full.FieldApi<string> }) => null } });
  });

  it("refuse a component whose field names a plugin", () => {
    const withDirty = createForms({ fields: { WithDirty } }).define({ defaultValues: { email: "" } });
    expectTypeOf<FormOf<typeof withDirty>["WithDirty"]>().toBeNever();
  });

  it("move to the full entry with the same fields and uses", () => {
    expectTypeOf<FormsOptions<typeof fields>>().toExtend<full.FormsOptions<[], FormError, typeof fields>>();
    <fullSignInForm.TextField name="email" label="Email" />;
    <fullSignInForm.TextField name="address.city" label="City" />;
    <fullSignInForm.NumberField name="age" />;
  });
});
