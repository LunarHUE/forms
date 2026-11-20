// Reusable components generic in the value they take, the pattern handles
// strict in their value type call for. See core's handle tests.
import type { ArrayHandle, FieldHandle, FormError } from "@lunarhue/forms-core";
import { describe, expectTypeOf, it } from "vitest";
import { Items, createField, createForm, createForms, createInputProps, inputProps, type FieldApi, type HandleOf } from "./index.js";
import { arrays } from "./plugins.js";

interface Tag {
  id: number;
  name: string;
}

function TextField(props: { field: FieldApi<string>; label: string }) {
  return <input {...inputProps(props.field)} aria-label={props.label} />;
}

const forms = createForms({ fields: { TextField }, plugins: [arrays()] });
const TagShape = forms.fieldset<Tag>();

function TagFields<T extends Tag>(props: { field: HandleOf<typeof TagShape, T> }) {
  const scope = TagShape.scope(props.field);
  return (
    <>
      <scope.TextField name="name" label="Name" />
      <scope.TextField handle={props.field.at("name")} label="Name" />
      <scope.Field name="name">{(field) => <input {...inputProps(field)} />}</scope.Field>
    </>
  );
}

const Other = forms.define({ defaultValues: { note: "" } });

function TagList<T extends Tag>(props: { tags: ArrayHandle<T[], FormError, "arrays">; create: (base: Tag) => T }) {
  const form = createForm(Other);
  return (
    <>
      <Items handle={props.tags}>
        {(tag) => {
          // A child T's constraint names reads as the constraint's type, so it
          // fits a FieldApi<string> component of any scope.
          const value: string = createField(tag.at("name")).value;
          // Functions that read the value type from the handle's own type need
          // the child typed by the constraint first.
          const name: FieldHandle<string, FormError, "arrays"> = tag.at("name");
          return (
            <>
              <TagFields field={tag} />
              <form.TextField handle={tag.at("name")} label={value} />
              <input {...createInputProps(name)} />
            </>
          );
        }}
      </Items>
      <button type="button" onClick={() => props.tags.push(props.create({ id: Date.now(), name: "new" }))}>
        Add
      </button>
    </>
  );
}

const Page = forms.define({ defaultValues: { tags: [{ id: 0, name: "", enabled: true }], one: { id: 1, name: "", enabled: false } } });

function PageForm() {
  const form = createForm(Page);
  return (
    <>
      <TagList tags={form.root.at("tags")} create={(base) => ({ ...base, enabled: true })} />
      <TagFields field={form.root.at("one")} />
      {/* @ts-expect-error: create has to return the form's item type */}
      <TagList tags={form.root.at("tags")} create={(base) => base} />
    </>
  );
}

declare function NarrowList(props: { tags: ArrayHandle<Tag[], FormError, "arrays"> }): null;
declare function NarrowFields(props: { field: HandleOf<typeof TagShape> }): null;

function NarrowUses() {
  const form = createForm(Page);
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
