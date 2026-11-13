import type { SchemaPlugin, StandardSchemaV1 } from "@lunarhue/forms-core";
import { definePlugin } from "./plugins.js";
import { validation } from "./plugins/validation.js";
import { describe, expectTypeOf, it } from "vitest";
import { createForms, type FieldApi, type FormOf, useForm } from "./index.js";

// What each plugin list lets the compiler accept. The components here are
// only type checked, never rendered.

interface FakeSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly fake: true;
}
declare const fakePlugin: SchemaPlugin<FakeSchema<unknown>>;
declare const profileSchema: FakeSchema<{ name: string }>;

function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  return <input aria-label={props.label} {...props.field.inputProps()} />;
}

const required = (value: string) => (value ? undefined : { message: "Required" });
const counter = definePlugin({ name: "counter", setup: () => ({ api: { count: (): number => 0 } }) });

describe("with no runner", () => {
  const forms = createForms({ plugins: [counter], fields: { TextField } });
  const profile = forms.define({ defaultValues: { name: "" } });

  function Page() {
    const form = useForm(profile);
    const scope = forms.scope(form.root);
    return (
      <>
        {/* @ts-expect-error: no plugin brings the runner */}
        <form.Field name="name" validate={required}>
          {(field) => field.value}
        </form.Field>
        {/* @ts-expect-error: no plugin brings the runner */}
        <form.TextField name="name" label="Name" validate={required} />
        {/* @ts-expect-error: no plugin brings the runner */}
        <scope.TextField name="name" label="Name" validate={required} />
        {/* @ts-expect-error: no plugin brings the runner */}
        <scope.Field name="name" validate={required}>
          {(field) => field.value}
        </scope.Field>
        <form.TextField name="name" label="Name" validate={false} />
        <form.TextField name="name" label="Name" />
      </>
    );
  }

  it("rejects a schema and validate in define", () => {
    // @ts-expect-error: no plugin brings the runner that runs the schema
    forms.define({ schema: profileSchema, defaultValues: { name: "" } });
    // @ts-expect-error: no plugin brings the runner
    forms.define({ defaultValues: { name: "" }, validate: { fields: { name: required } } });
    expectTypeOf(forms).toHaveProperty("define");
  });

  it("rejects the validate prop on Field, bound and scope components", () => {
    expectTypeOf(Page).toBeFunction();
  });

  it("still has the plugin APIs", () => {
    expectTypeOf<FormOf<typeof profile>["plugins"]>().toEqualTypeOf<{ readonly counter: { count: () => number } }>();
  });
});

describe("with validation()", () => {
  const forms = createForms({ plugins: [validation()], fields: { TextField } });
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
  const checked = forms.define({ defaultValues: { name: "" }, plugins: [validation(), counter] });
  const plain = forms.define({ defaultValues: { name: "" } });

  function Page() {
    const form = useForm(checked);
    const other = useForm(plain);
    return (
      <>
        <form.TextField name="name" label="Name" validate={required} />
        {/* @ts-expect-error: this form's plugins bring no runner */}
        <other.TextField name="name" label="Name" validate={required} />
      </>
    );
  }

  it("count for that form alone", () => {
    expectTypeOf(Page).toBeFunction();
    expectTypeOf<FormOf<typeof checked>["plugins"]["counter"]["count"]>().toEqualTypeOf<() => number>();
    expectTypeOf(forms.define({ schema: profileSchema, plugins: [fakePlugin] })).toBeObject();
  });
});
