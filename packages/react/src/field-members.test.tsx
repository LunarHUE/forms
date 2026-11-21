import type { PluginContext } from "@lunarhue/forms-core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createForms, type ExactFieldApi, type FormError, useForm } from "./index.js";
import { definePlugin } from "./plugins.js";

// A snapshot has `meta` only once a plugin sets some, so this sets it on
// every field the test renders. Without it a field object would lack `meta`.
const marked = definePlugin({
  name: "marked",
  initialMeta: false,
  setup(ctx: PluginContext<boolean>) {
    const keys = ctx.store.getSnapshot(["rows"]).keys ?? [];
    for (const path of [["name"], ["address"], ["rows"], ...keys.map((key) => ["rows", key])]) ctx.setMeta(path, true);
    return {};
  },
})();

const forms = createForms({ plugins: [marked] });
const order = forms.define({
  defaultValues: { name: "", address: { city: "" }, rows: [{ title: "a" }] },
});

/**
 * The members each field type declares. `true` marks a member the object has
 * at runtime, `false` one that is type information only. A member added to
 * the type and missing here fails to compile.
 */
const snapshotMembers = {
  value: true,
  name: true,
  errors: true,
  userErrors: true,
  shownErrors: true,
  invalid: true,
  touched: true,
  edited: true,
  dirty: true,
  validating: true,
  disabled: true,
  readOnly: true,
  meta: true,
} as const;
const commonMembers = {
  ...snapshotMembers,
  id: true,
  path: true,
  handleBlur: true,
  setTouched: true,
  setErrors: true,
  validate: true,
  reset: true,
  setDisabled: true,
  setReadOnly: true,
  setValue: true,
  handle: true,
  errorId: true,
  text: true,
  setText: true,
  ref: true,
  "~types": false,
} as const;
// `dirty` is always on the object at runtime. Its type has it with `dirty()` only.
type Api<V> = ExactFieldApi<V, FormError, "dirty">;
const leafMembers = commonMembers satisfies Record<keyof Api<string>, boolean>;
const objectMembers = { ...commonMembers, at: true } satisfies Record<keyof Api<{ title: string }>, boolean>;
const arrayMembers = {
  ...commonMembers,
  keys: true,
  push: true,
  insert: true,
  remove: true,
  move: true,
  item: true,
} satisfies Record<keyof Api<{ title: string }[]>, boolean>;

/**
 * Every core handle carries the structure commands of every kind, and the
 * field object copies them all, so a field has the ones its type leaves out.
 */
const structureCommands = ["at", "item", "push", "insert", "remove", "move"];

/** The members a field object should have at runtime: the declared ones and the structure commands. */
function expectedMembers(declared: Readonly<Record<string, boolean>>): Set<string> {
  const present = Object.keys(declared).filter((member) => declared[member]);
  return new Set([...present, ...structureCommands]);
}

/** The field objects `Fields` rendered, by kind. */
const fields = new Map<string, object>();

/** The own members of the field object `Fields` rendered for `kind`. */
const ownMembers = (kind: string): Set<string> => new Set(Object.keys(fields.get(kind) ?? {}));

/** Keeps `field` under `kind` and renders nothing. */
function keep(kind: string, field: object): null {
  fields.set(kind, field);
  return null;
}

function Fields() {
  const form = useForm(order);
  const rows = form.root.at("rows");
  const row = rows.item(rows.peek().keys[0] ?? "");
  return (
    <>
      <form.Field name="name">{(field) => keep("leaf", field)}</form.Field>
      <form.Field name="address">{(field) => keep("object", field)}</form.Field>
      <form.Field name="rows">{(field) => keep("array", field)}</form.Field>
      <form.Field handle={row}>{(field) => keep("item", field)}</form.Field>
    </>
  );
}

describe("a field object's members", () => {
  it("match what its type declares, for leaf, object, array and item fields", () => {
    render(<Fields />);

    expect(ownMembers("leaf")).toEqual(expectedMembers(leafMembers));
    expect(ownMembers("object")).toEqual(expectedMembers(objectMembers));
    expect(ownMembers("array")).toEqual(expectedMembers(arrayMembers));
    // An item's field type is the field type of its value, which has no `key`.
    expect(ownMembers("item")).toEqual(expectedMembers(objectMembers));
  });
});
