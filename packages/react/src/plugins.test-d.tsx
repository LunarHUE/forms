import type { FormError, SchemaPlugin, StandardSchemaV1 } from "@lunarhue/forms-core";
import { definePlugin, dirty } from "./plugins.js";
import { describe, expectTypeOf, it } from "vitest";
import { createForms, type FieldApi, type FormOf, inputProps, type LeafHandle, type UnknownForm, useForm, useFormContext } from "./index.js";

// What each plugin list lets the compiler accept. The components here are
// only type checked, never rendered.

interface FakeSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly fake: true;
}
declare const fakePlugin: SchemaPlugin<FakeSchema<unknown>>;
declare const profileSchema: FakeSchema<{ name: string }>;

function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  return <input aria-label={props.label} {...inputProps(props.field)} />;
}

const required = (value: string) => (value ? undefined : { message: "Required" });
const counter = definePlugin({ name: "counter", setup: () => ({ api: { count: (): number => 0 } }) });

describe("with no plugins", () => {
  const forms = createForms({ fields: { TextField } });
  const profile = forms.define({ defaultValues: { name: "" }, validate: { fields: { name: required } } });

  function Page() {
    const form = useForm(profile);
    const scope = forms.scope(form.root);
    return (
      <>
        <form.Field name="name" validate={required}>
          {(field) => field.value}
        </form.Field>
        <form.Field handle={form.root.at("name")} validate={(value) => (value ? undefined : { message: "Required" })}>
          {(field) => field.value}
        </form.Field>
        <form.TextField name="name" label="Name" validate={required} />
        <scope.TextField name="name" label="Name" validate={{ validate: required, debounce: 100 }} />
      </>
    );
  }

  it("accepts validate everywhere, and any Standard Schema with complete defaultValues", () => {
    // @ts-expect-error: no schema plugin gives defaults for it, so defaultValues is required
    forms.define({ schema: profileSchema });
    const fromSchema = forms.define({ schema: profileSchema, defaultValues: { name: "" } });
    expectTypeOf<FormOf<typeof fromSchema>["root"]["peek"]>().returns.toHaveProperty("value").toEqualTypeOf<{ readonly name: string }>();
    expectTypeOf(Page).toBeFunction();
  });
});

describe("with a schema plugin", () => {
  const forms = createForms({ plugins: [fakePlugin], fields: { TextField } });
  const profile = forms.define({ schema: profileSchema, validate: { fields: { name: required } } });

  function Page() {
    const form = useForm(profile);
    return <form.TextField name="name" label="Name" validate={required} />;
  }

  it("accepts its schemas and validate", () => {
    expectTypeOf(Page).toBeFunction();
  });
});

describe("plugins on the definition", () => {
  const forms = createForms({ fields: { TextField } });
  const checked = forms.define({ defaultValues: { name: "" }, plugins: [counter], validate: { fields: { name: required } } });
  const plain = forms.define({ defaultValues: { name: "" } });

  function Page() {
    const form = useForm(checked);
    const other = useForm(plain);
    return (
      <>
        <form.TextField name="name" label="Name" validate={required} />
        <other.TextField name="name" label="Name" validate={required} />
      </>
    );
  }

  it("count for that form alone", () => {
    expectTypeOf(Page).toBeFunction();
    expectTypeOf<FormOf<typeof checked>["plugins"]["counter"]["count"]>().toEqualTypeOf<() => number>();
    expectTypeOf(forms.define({ schema: profileSchema, plugins: [fakePlugin] })).toBeObject();
  });

  it("satisfy that form's equals, next to the shared plugins' APIs", () => {
    const shared = createForms({ plugins: [counter], fields: { TextField } });
    const tracked = shared.define({ defaultValues: { name: "" }, plugins: [dirty()], equals: (a, b, _ctx, next) => next(a, b) });
    expectTypeOf<FormOf<typeof tracked>["plugins"]["counter"]["count"]>().toEqualTypeOf<() => number>();
    // @ts-expect-error: no plugin brings dirty tracking
    shared.define({ defaultValues: { name: "" }, equals: (a: unknown, b: unknown) => a === b });
  });
});

describe("useFormContext(forms)", () => {
  const forms = createForms({ plugins: [counter], fields: { TextField } });
  const tagger = definePlugin({ name: "tagger", setup: () => ({ api: { tag: (): string => "" } }) });
  forms.define({ defaultValues: { name: "" }, plugins: [tagger] });

  interface SharedProps {
    readonly name: LeafHandle<string>;
  }

  function Shared({ name }: SharedProps) {
    const form = useFormContext(forms);
    expectTypeOf(form.plugins).toEqualTypeOf<{ readonly counter: { count: () => number } }>();
    // A definition's own plugins are not shared.
    expectTypeOf(form.plugins).not.toHaveProperty("tagger");
    return (
      <>
        <form.Field handle={name} validate={required}>
          {(field) => field.value}
        </form.Field>
        <form.TextField handle={name} label="Name" validate={required} />
        <button type="button" onClick={() => form.plugins.counter.count()}>
          Count
        </button>
      </>
    );
  }

  it("types the shared plugins, the validate prop and the registered fields", () => {
    expectTypeOf(Shared).toBeFunction();
    expectTypeOf(useFormContext(forms)).toEqualTypeOf<FormOf<typeof forms>>();
    expectTypeOf<FormOf<typeof forms>>().toEqualTypeOf<UnknownForm<[typeof counter], FormError, { readonly TextField: typeof TextField }>>();
  });
});
