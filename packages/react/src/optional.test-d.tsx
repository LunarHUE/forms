// Text and checkbox components for optional and nullable fields. A
// `FieldApi<T | undefined>` component takes required and optional fields of
// `T`; a `FieldApi<T>` component takes required ones only, so its reads of
// `field.value` stay `T`.
import { describe, expectTypeOf, it } from "vitest";
import {
  createForms,
  inputProps,
  useForm,
  type FieldApi,
  type HandleOf,
  type Plugin,
  type StandardSchemaV1,
} from "./index.js";

interface FakeSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly fake: true;
}
declare const fakePlugin: Plugin<undefined, "fake", never, never, FakeSchema<unknown>>;

function TextField(props: { readonly field: FieldApi<string | undefined>; readonly label: string }) {
  expectTypeOf(props.field.value).toEqualTypeOf<string | undefined>();
  return <input {...inputProps(props.field)} aria-label={props.label} />;
}

function Checkbox(props: { readonly field: FieldApi<boolean | undefined>; readonly label: string }) {
  expectTypeOf(props.field.value).toEqualTypeOf<boolean | undefined>();
  return <input {...inputProps(props.field, { kind: "checkbox" })} aria-label={props.label} />;
}

function NullableText(props: { readonly field: FieldApi<string | null | undefined> }) {
  expectTypeOf(props.field.value).toEqualTypeOf<string | null | undefined>();
  return <input {...inputProps(props.field)} />;
}

function RequiredText(props: { readonly field: FieldApi<string> }) {
  return <input {...inputProps(props.field)} />;
}

const forms = createForms({ plugins: [fakePlugin], fields: { TextField, Checkbox, NullableText, RequiredText } });

interface Profile {
  name: string;
  nick?: string;
  bio: string | undefined;
  note: string | null;
  agree: boolean;
  news?: boolean;
  age?: number;
}

const typed = forms.define<Profile>({ defaultValues: { name: "", bio: undefined, note: null, agree: false } });

declare const profileSchema: FakeSchema<Profile>;
const schemaForm = forms.define({ schema: profileSchema });

function TypedFields() {
  const form = useForm(typed);
  return (
    <>
      <form.TextField name="name" label="Name" />
      <form.TextField name="nick" label="Nick" />
      <form.TextField name="bio" label="Bio" />
      <form.TextField handle={form.root.at("name")} label="Name" />
      <form.TextField handle={form.root.at("nick")} label="Nick" />
      <form.Checkbox name="agree" label="Agree" />
      <form.Checkbox name="news" label="News" />
      <form.Checkbox handle={form.root.at("news")} label="News" />
      <form.NullableText name="note" />
      <form.NullableText name="nick" />
      <form.NullableText name="name" />
      {/* @ts-expect-error: a number field doesn't fit a text component */}
      <form.TextField name="age" label="Age" />
      {/* @ts-expect-error: a nullable field doesn't fit a component that reads string | undefined */}
      <form.TextField name="note" label="Note" />
      {/* @ts-expect-error: a boolean field doesn't fit a text component */}
      <form.TextField name="news" label="News" />
    </>
  );
}

function SchemaFields() {
  const form = useForm(schemaForm);
  return (
    <>
      <form.TextField name="name" label="Name" />
      <form.TextField name="nick" label="Nick" />
      <form.TextField handle={form.root.at("nick")} label="Nick" />
      <form.Checkbox name="agree" label="Agree" />
      <form.Checkbox name="news" label="News" />
    </>
  );
}

function RequiredOnly() {
  const form = useForm(typed);
  return (
    <>
      <form.RequiredText name="name" />
      {/* @ts-expect-error: field.value would read string and hold undefined */}
      <form.RequiredText name="nick" />
      {/* @ts-expect-error: as by name */}
      <form.RequiredText handle={form.root.at("nick")} />
    </>
  );
}

const ProfileShape = forms.fieldset<Profile>();

// A generic component reaches optional children by name.
function ProfileFields<P extends Profile>(props: { readonly field: HandleOf<typeof ProfileShape, P> }) {
  const scope = ProfileShape.scope(props.field);
  return (
    <>
      <scope.TextField name="nick" label="Nick" />
      <scope.TextField name="name" label="Name" />
      <scope.Checkbox name="news" label="News" />
      <scope.TextField handle={props.field.at("name")} label="Name" />
      {/* @ts-expect-error: known limit, a generic child with an optional constraint doesn't fit by handle */}
      <scope.TextField handle={props.field.at("nick")} label="Nick" />
    </>
  );
}

describe("optional fields", () => {
  it("fit a FieldApi<T | undefined> component from a type given to define", () => {
    expectTypeOf(TypedFields).toBeFunction();
  });
  it("fit a FieldApi<T | undefined> component from a schema", () => {
    expectTypeOf(SchemaFields).toBeFunction();
  });
  it("don't fit a FieldApi<T> component, whose value reads T", () => {
    expectTypeOf(RequiredOnly).toBeFunction();
  });
  it("fit from a generic component by name", () => {
    expectTypeOf(ProfileFields).toBeFunction();
  });
});
