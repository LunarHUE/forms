// Reusable components generic in the value they take, the pattern handles
// strict in their value type call for. See core's handle tests.
import { describe, expectTypeOf, it } from "vitest";
import {
  Items,
  createForms,
  inputProps,
  useField,
  useForm,
  type NamedArrayHandle,
  type FieldApi,
  type NamedFieldHandle,
  type FormError,
  type HandleOf,
} from "./index.js";
import { arrays } from "./plugins.js";

interface Tag {
  id: number;
  name: string;
}

function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  return <input {...inputProps(props.field)} aria-label={props.label} />;
}

const forms = createForms({ fields: { TextField }, plugins: [arrays()] });
const TagShape = forms.fieldset<Tag>();

function TagFields<T extends Tag>(props: { readonly field: HandleOf<typeof TagShape, T> }) {
  const scope = TagShape.scope(props.field);
  return (
    <>
      <scope.TextField name="name" label="Name" />
      <scope.TextField handle={props.field.at("name")} label="Name" />
      <scope.Field name="name">{(field) => <input {...inputProps(field)} />}</scope.Field>
    </>
  );
}

function TagRow<T extends Tag>(props: { readonly tag: HandleOf<typeof TagShape, T> }) {
  // A child T's constraint names reads as the constraint's type, so it fits a
  // FieldApi<string> component of any scope, and the hooks.
  const value: string = useField(props.tag.at("name")).value;
  // Hooks that read the value type from the handle's own type need the child
  // typed by the constraint first.
  const name: NamedFieldHandle<string> = props.tag.at("name");
  const other = useForm(Other);
  return (
    <>
      <TagFields field={props.tag} />
      <other.TextField handle={props.tag.at("name")} label={value} />
      <input {...inputProps(useField(name))} />
    </>
  );
}

function TagList<T extends Tag>(props: { readonly tags: NamedArrayHandle<T[], FormError, "arrays">; readonly create: (base: Tag) => T }) {
  return (
    <>
      <Items handle={props.tags}>{(tag) => <TagRow tag={tag} />}</Items>
      <button type="button" onClick={() => props.tags.push(props.create({ id: Date.now(), name: "new" }))}>
        Add
      </button>
    </>
  );
}

const Other = forms.define({ defaultValues: { note: "" } });
const Page = forms.define({ defaultValues: { tags: [{ id: 0, name: "", enabled: true }], one: { id: 1, name: "", enabled: false } } });

function PageForm() {
  const form = useForm(Page);
  return (
    <>
      <TagList tags={form.root.at("tags")} create={(base) => ({ ...base, enabled: true })} />
      <TagFields field={form.root.at("one")} />
      {/* @ts-expect-error: create has to return the form's item type */}
      <TagList tags={form.root.at("tags")} create={(base) => base} />
    </>
  );
}

declare function NarrowList(props: { readonly tags: NamedArrayHandle<Tag[], FormError, "arrays"> }): null;
declare function NarrowFields(props: { readonly field: HandleOf<typeof TagShape> }): null;

function NarrowUses() {
  const form = useForm(Page);
  return (
    <>
      {/* @ts-expect-error: a list of Tag would push items without enabled */}
      <NarrowList tags={form.root.at("tags")} />
      {/* @ts-expect-error: a Tag fieldset would replace the value without enabled */}
      <NarrowFields field={form.root.at("one")} />
    </>
  );
}

describe("generic reusable components", () => {
  it("take wider handles, and the narrow ones don't", () => {
    expectTypeOf(PageForm).toBeFunction();
    expectTypeOf(NarrowUses).toBeFunction();
  });
});
