import type { PluginContext } from "@lunarhue/forms-core";
import { createMemo, createRoot, flush } from "solid-js";
import { describe, expect, it } from "vitest";
import { createField, createForm, createForms, type ExactFieldApi, type FieldApi, type FormOf } from "../index.js";
import { definePlugin } from "../plugins.js";
import { getAs, mount } from "./dom.js";

function TextField(props: { field: FieldApi<string>; label: string }) {
  return (
    <>
      <label for={props.field.id}>{props.label}</label>
      <input data-label={props.label} {...props.field.inputProps()} />
      <output data-label={props.label}>{props.field.path.join("/")}</output>
    </>
  );
}

const forms = createForms({ fields: { TextField } });
const Order = forms.define({
  defaultValues: { name: "", address: { city: "" }, rows: [{ title: "a" }, { title: "b" }] },
});
type OrderForm = FormOf<typeof Order>;

/** Makes the order form outside any component, and returns it with its dispose. */
function makeForm(): { readonly form: OrderForm; readonly dispose: () => void } {
  return createRoot((dispose) => ({ form: createForm(Order, { id: "order" }), dispose }));
}

/** The stable key of the first row. */
function firstKey(form: OrderForm): string {
  const key = form.root.at("rows").peek().keys[0];
  if (key === undefined) throw new Error("Expected a row.");
  return key;
}

describe("a field object's id and path", () => {
  it("are the handle's, for a plain field, a nested field and an item", () => {
    const { form, dispose } = makeForm();
    const key = firstKey(form);
    const name = form.root.at("name");
    const city = form.root.at("address").at("city");
    const row = form.root.at("rows").item(key);

    const fields = [createField(name), createField(city), createField(row), createField(row.at("title"))];
    expect(fields.map((field) => field.id)).toEqual([name.id, city.id, row.id, row.at("title").id]);
    expect(fields.map((field) => field.path)).toEqual([["name"], ["address", "city"], ["rows", key], ["rows", key, "title"]]);
    expect(createField(name).id).toBe("order--name");
    dispose();
  });

  it("gives an item field its key, which stays put when the item moves", () => {
    const { form, dispose } = makeForm();
    const key = firstKey(form);
    const field = createField(form.root.at("rows").item(key));
    expect(Reflect.get(field, "key")).toBe(key);

    form.root.at("rows").move(0, 1);
    expect(Reflect.get(field, "key")).toBe(key);
    expect(field.path).toEqual(["rows", key]);
    expect(field.name).toBe("rows.1");
    dispose();
  });

  it("are set on the field `form.Field` passes to its children", () => {
    const seen: { id: string; path: readonly unknown[] }[] = [];
    mount(() => {
      const form = createForm(Order, { id: "order" });
      return (
        <>
          <form.Field name="name">{(field) => (seen.push({ id: field.id, path: field.path }), <p />)}</form.Field>
          <form.Field name="address.city">{(field) => (seen.push({ id: field.id, path: field.path }), <p />)}</form.Field>
        </>
      );
    });
    expect(seen).toEqual([
      { id: "order--name", path: ["name"] },
      { id: "order--address--city", path: ["address", "city"] },
    ]);
  });

  it("are set on a registered component's `field` prop, so a label can point at its input", () => {
    const { host } = mount(() => {
      const form = createForm(Order, { id: "order" });
      return (
        <>
          <form.TextField name="name" label="Name" />
          <form.TextField name="address.city" label="City" />
        </>
      );
    });
    for (const [label, path] of [
      ["Name", "name"],
      ["City", "address/city"],
    ] as const) {
      const input = getAs(host, `input[data-label=${label}]`, HTMLInputElement);
      const labelElement = [...host.querySelectorAll("label")].find((element) => element.textContent === label);
      expect(input.id).not.toBe("");
      expect(labelElement?.htmlFor).toBe(input.id);
      expect(getAs(host, `output[data-label=${label}]`, HTMLOutputElement).textContent).toBe(path);
    }
  });
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
  inputProps: true,
  "~field": false,
} as const;
const leafMembers = commonMembers satisfies Record<keyof ExactFieldApi<string>, boolean>;
const objectMembers = { ...commonMembers, at: true } satisfies Record<keyof ExactFieldApi<{ title: string }>, boolean>;
const arrayMembers = {
  ...commonMembers,
  keys: true,
  push: true,
  insert: true,
  remove: true,
  move: true,
  item: true,
} satisfies Record<keyof ExactFieldApi<{ title: string }[]>, boolean>;

/**
 * Every core handle carries the structure commands of every kind, and the
 * field object copies them all, so a field has the ones its type leaves out.
 */
const structureCommands = ["at", "item", "push", "insert", "remove", "move"];

/** The members a field object should have at runtime: the declared ones, the structure commands, and `extra`. */
function expectedMembers(declared: Readonly<Record<string, boolean>>, extra: readonly string[] = []): Set<string> {
  const present = Object.keys(declared).filter((member) => declared[member]);
  return new Set([...present, ...structureCommands, ...extra]);
}

/** The field object's own members. */
const ownMembers = (field: object): Set<string> => new Set(Object.keys(field));

describe("a field object's members", () => {
  it("match what its type declares, for leaf, object, array and item fields", () => {
    const { form, dispose } = makeForm();
    const rows = form.root.at("rows");

    expect(ownMembers(createField(form.root.at("name")))).toEqual(expectedMembers(leafMembers));
    expect(ownMembers(createField(form.root.at("address")))).toEqual(expectedMembers(objectMembers));
    expect(ownMembers(createField(rows))).toEqual(expectedMembers(arrayMembers));
    // An item's field type is the field type of its value, which has no `key` yet.
    expect(ownMembers(createField(rows.item(firstKey(form))))).toEqual(expectedMembers(objectMembers, ["key"]));
    dispose();
  });
});

// Stores each written string's length as the field's meta.
const chars = definePlugin({
  name: "chars",
  setup: (ctx: PluginContext<number>) => ({
    onWrite(records) {
      for (const record of records) if (record.type === "value") ctx.setMeta(record.path, String(record.after).length);
    },
  }),
});

describe("a field object's meta", () => {
  it("is reactive, so a plugin's meta reader tracks it", () => {
    const Named = createForms({ plugins: [chars] }).define({ defaultValues: { name: "" } });
    const { field, length, dispose } = createRoot((stop) => {
      const name = createField(createForm(Named).root.at("name"));
      return { field: name, length: createMemo(() => chars.meta(name)), dispose: stop };
    });
    expect(Object.keys(field)).toContain("meta");
    expect(length()).toBeUndefined();

    field.setValue("ada");
    flush();
    expect(length()).toBe(3);
    dispose();
  });
});
