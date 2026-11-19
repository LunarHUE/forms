import { describe, expectTypeOf, it } from "vitest";
import { type Change, createForms, type FieldApi, type FormError, useField, useForm, useFormState } from "./index.js";
import { dirty } from "./plugins.js";

// A registered component that shows whether its field changed, so it needs dirty().
function ChangedMark(props: { readonly field: FieldApi<string, FormError, "dirty"> }) {
  return <span>{props.field.dirty ? "*" : ""}</span>;
}

// One that reads no plugin member, so it fits every form.
function Plain(props: { readonly field: FieldApi<string> }) {
  return <span>{props.field.value}</span>;
}

const value = { name: "", tags: [""] };
const tracked = createForms({ plugins: [dirty()], fields: { ChangedMark, Plain } }).define({ defaultValues: value });
const bare = createForms({ fields: { ChangedMark, Plain } }).define({ defaultValues: value });

function Tracked() {
  const form = useForm(tracked);
  expectTypeOf(useField(form.root.at("name")).dirty).toEqualTypeOf<boolean>();
  expectTypeOf(useFormState(form).dirty).toEqualTypeOf<boolean>();
  expectTypeOf(useFormState(form, (snapshot) => snapshot.dirty)).toEqualTypeOf<boolean>();
  expectTypeOf(form.store.changes()).toEqualTypeOf<readonly Change[]>();
  return (
    <>
      <form.Field name="name">{(field) => <span>{String(field.dirty)}</span>}</form.Field>
      <form.Field name="name" select={(snapshot) => snapshot.dirty}>
        {(changed) => <span>{String(changed)}</span>}
      </form.Field>
      <form.Items name="tags">{(item) => <span>{String(item.peek().dirty)}</span>}</form.Items>
      <form.State select={(snapshot) => snapshot.dirty}>{(changed) => <span>{String(changed)}</span>}</form.State>
      <form.ChangedMark name="name" />
      <form.Plain name="name" />
    </>
  );
}

function Bare() {
  const form = useForm(bare);
  // @ts-expect-error: the form has no dirty()
  void useField(form.root.at("name")).dirty;
  // @ts-expect-error: the form has no dirty()
  void useFormState(form).dirty;
  // @ts-expect-error: the form has no dirty()
  form.store.changes();
  return (
    <>
      {/* @ts-expect-error: the form has no dirty() */}
      <form.Field name="name">{(field) => <span>{String(field.dirty)}</span>}</form.Field>
      {/* @ts-expect-error: the form has no dirty() */}
      <form.State select={(snapshot) => snapshot.dirty}>{(changed) => <span>{String(changed)}</span>}</form.State>
      {/* @ts-expect-error: ChangedMark needs a form with dirty() */}
      <form.ChangedMark name="name" />
      {/* @ts-expect-error: ChangedMark needs a form with dirty() */}
      <form.ChangedMark handle={form.root.at("name")} />
      <form.Plain name="name" />
    </>
  );
}

describe("dirty members in React", () => {
  it("are typed from the form's plugins", () => {
    expectTypeOf(Tracked).toBeFunction();
    expectTypeOf(Bare).toBeFunction();
  });
});
