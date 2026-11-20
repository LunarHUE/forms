import { definePlugin, dirty } from "./plugins.js";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import type { FormError } from "@lunarhue/forms-core";
import { debounced, createForm, createForms, inputProps, useFormContext, type AnyForm, type FieldApi, type FieldHandle, type FormOf, fieldValidators } from "./index.js";

// What each plugin list lets the compiler accept. The components here are
// only type checked, never rendered.

const profileSchema = v.object({ name: v.string() });

function TextField(props: { field: FieldApi<string>; label: string }) {
  return <input aria-label={props.label} {...inputProps(props.field)} />;
}

const required = (value: string) => (value ? undefined : { message: "Required" });
const counter = definePlugin({ name: "counter", setup: () => ({ api: { count: (): number => 0 } }) });

describe("with no plugins", () => {
  const forms = createForms({ fields: { TextField } });
  const Profile = forms.define({ defaultValues: { name: "" }, validate: { fields: fieldValidators({ name: required }) } });

  function Page() {
    const form = createForm(Profile);
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
        <scope.TextField name="name" label="Name" validate={debounced(required, 100)} />
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
  const forms = createForms({ plugins: [valibot()], fields: { TextField } });
  const Profile = forms.define({ schema: profileSchema, validate: { fields: fieldValidators({ name: required }) } });

  function Page() {
    const form = createForm(Profile);
    return <form.TextField name="name" label="Name" validate={required} />;
  }

  it("accepts its schemas and validate", () => {
    expectTypeOf(Page).toBeFunction();
  });
});

describe("plugins on the definition", () => {
  const forms = createForms({ fields: { TextField } });
  const Checked = forms.define({ defaultValues: { name: "" }, plugins: [counter], validate: { fields: fieldValidators({ name: required }) } });
  const Plain = forms.define({ defaultValues: { name: "" } });

  function Page() {
    const form = createForm(Checked);
    const other = createForm(Plain);
    return (
      <>
        <form.TextField name="name" label="Name" validate={required} />
        <other.TextField name="name" label="Name" validate={required} />
      </>
    );
  }

  it("count for that form alone", () => {
    expectTypeOf(Page).toBeFunction();
    expectTypeOf<FormOf<typeof Checked>["plugins"]["counter"]["count"]>().toEqualTypeOf<() => number>();
    expectTypeOf(forms.define({ schema: profileSchema, plugins: [valibot()] })).toBeObject();
  });
});

describe("a definition's own schema plugin and dirty()", () => {
  const forms = createForms({ plugins: [counter], fields: { TextField } });
  const Profile = forms.define({ schema: profileSchema, plugins: [valibot(), dirty()], equals: (a, b, _ctx, next) => next(a, b) });

  it("satisfy that form's schema and equals, next to the shared plugins' APIs", () => {
    expectTypeOf<FormOf<typeof Profile>["plugins"]["counter"]["count"]>().toEqualTypeOf<() => number>();
    // @ts-expect-error: no plugin brings dirty tracking
    forms.define({ schema: profileSchema, plugins: [valibot()], equals: (a: unknown, b: unknown) => a === b });
    // @ts-expect-error: dirty() is no schema plugin, so defaultValues is required
    forms.define({ schema: profileSchema, plugins: [dirty()] });
  });
});

describe("useFormContext(forms)", () => {
  const forms = createForms({ plugins: [counter], fields: { TextField } });
  const tagger = definePlugin({ name: "tagger", setup: () => ({ api: { tag: (): string => "" } }) });
  forms.define({ defaultValues: { name: "" }, plugins: [tagger] });

  interface SharedProps {
    readonly name: FieldHandle<string>;
  }

  function Shared(props: SharedProps) {
    const form = useFormContext(forms);
    expectTypeOf(form.plugins).toEqualTypeOf<{ readonly counter: { count: () => number } }>();
    // A definition's own plugins are not shared.
    expectTypeOf(form.plugins).not.toHaveProperty("tagger");
    return (
      <>
        <form.Field handle={props.name} validate={required}>
          {(field) => field.value}
        </form.Field>
        <form.TextField handle={props.name} label="Name" validate={required} />
        <button type="button" onClick={() => form.plugins.counter.count()}>
          Count
        </button>
      </>
    );
  }

  it("types the shared plugins, the validate prop and the registered fields", () => {
    expectTypeOf(Shared).toBeFunction();
    expectTypeOf(useFormContext(forms)).toEqualTypeOf<FormOf<typeof forms>>();
    expectTypeOf<FormOf<typeof forms>>().toEqualTypeOf<
      AnyForm<readonly [typeof counter], FormError, { readonly TextField: typeof TextField }>
    >();
  });
});
