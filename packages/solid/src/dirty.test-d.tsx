import { describe, expectTypeOf, it } from "vitest";
import { type Change, createField, createForm, createForms, type FieldApi } from "./index.js";
import { dirty } from "./plugins.js";

// A registered component that shows whether its field changed, so it needs dirty().
function ChangedMark(props: { field: FieldApi<string, typeof dirty> }) {
  return <span>{props.field.dirty ? "*" : ""}</span>;
}

// One that reads no plugin member, so it fits every form.
function Plain(props: { field: FieldApi<string> }) {
  return <span>{props.field.value}</span>;
}

const value = { name: "", tags: [""] };
const Tracked = createForms({ plugins: [dirty()], fields: { ChangedMark, Plain } }).define({ defaultValues: value });
const Bare = createForms({ fields: { ChangedMark, Plain } }).define({ defaultValues: value });

function TrackedPage() {
  const form = createForm(Tracked);
  expectTypeOf(createField(form.root.at("name")).dirty).toEqualTypeOf<boolean>();
  expectTypeOf(form.state.dirty).toEqualTypeOf<boolean>();
  expectTypeOf(form.store.changes()).toEqualTypeOf<readonly Change[]>();
  return (
    <>
      <form.Field name="name">{(field) => <span>{String(field.dirty)}</span>}</form.Field>
      <span>{String(form.root.at("tags").item("k0").peek().dirty)}</span>
      <form.ChangedMark name="name" />
      <form.Plain name="name" />
    </>
  );
}

function BarePage() {
  const form = createForm(Bare);
  // @ts-expect-error: the form has no dirty()
  void createField(form.root.at("name")).dirty;
  // @ts-expect-error: the form has no dirty()
  void form.state.dirty;
  // @ts-expect-error: the form has no dirty()
  form.store.changes();
  return (
    <>
      {/* @ts-expect-error: the form has no dirty() */}
      <form.Field name="name">{(field) => <span>{String(field.dirty)}</span>}</form.Field>
      {/* @ts-expect-error: ChangedMark needs a form with dirty() */}
      <form.ChangedMark name="name" />
      {/* @ts-expect-error: ChangedMark needs a form with dirty() */}
      <form.ChangedMark handle={form.root.at("name")} />
      <form.Plain name="name" />
    </>
  );
}

describe("dirty members in Solid", () => {
  it("are typed from the form's plugins", () => {
    expectTypeOf(TrackedPage).toBeFunction();
    expectTypeOf(BarePage).toBeFunction();
  });
});
