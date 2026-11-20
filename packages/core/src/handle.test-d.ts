import { describe, expectTypeOf, it } from "vitest";
import type {
  AnyFieldHandle,
  ArrayHandle,
  Branch,
  ErrorOf,
  FieldHandle,
  FieldSnapshot,
  FormError,
  HandleBase,
  ItemHandle,
  LeafHandle,
  ObjectHandle,
  Patch,
  ValueOf,
  WriteOptions,
} from "./index.js";
import { createFormsCore } from "./index.js";
import { arrays } from "./plugins/arrays.js";

interface Address {
  street: string;
  city: string;
}

interface Row {
  title: string;
  done: boolean;
}

declare const channels: ArrayHandle<("email" | "sms")[], FormError, "arrays">;
declare const optionalChannels: ArrayHandle<("email" | "sms" | undefined)[], FormError, "arrays">;
declare const nullableChannels: ArrayHandle<("email" | "sms" | null)[], FormError, "arrays">;
declare const flags: ArrayHandle<boolean[], FormError, "arrays">;
declare const emails: ArrayHandle<"email"[], FormError, "arrays">;

type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };

interface Profile {
  name: string;
  born: Date;
  address?: Address;
  rows: Row[];
  tags: string[];
}

declare const profile: ObjectHandle<Profile>;
declare const listed: ObjectHandle<Profile, FormError, "arrays">;
declare const shape: ObjectHandle<Shape>;
declare const branch: Branch;
declare const other: FieldSnapshot<Address>;
declare const nameHandle: LeafHandle<string, { code: string }>;

describe("FieldHandle picks the handle from the value type", () => {
  it("gives leaves for primitives, Date, Map, Set and functions", () => {
    expectTypeOf<FieldHandle<string>>().toEqualTypeOf<LeafHandle<string>>();
    expectTypeOf<FieldHandle<number | undefined>>().toEqualTypeOf<LeafHandle<number | undefined>>();
    expectTypeOf<FieldHandle<Date>>().toEqualTypeOf<LeafHandle<Date>>();
    expectTypeOf<FieldHandle<Date | null>>().toEqualTypeOf<LeafHandle<Date | null>>();
    expectTypeOf<FieldHandle<Map<string, number>>>().toEqualTypeOf<LeafHandle<Map<string, number>>>();
    expectTypeOf<FieldHandle<Set<string>>>().toEqualTypeOf<LeafHandle<Set<string>>>();
    expectTypeOf<FieldHandle<() => void>>().toEqualTypeOf<LeafHandle<() => void>>();
    expectTypeOf<FieldHandle<"a" | "b">>().toEqualTypeOf<LeafHandle<"a" | "b">>();
  });

  it("gives objects for plain objects, optional or not", () => {
    expectTypeOf<FieldHandle<Address>>().toEqualTypeOf<ObjectHandle<Address>>();
    expectTypeOf<FieldHandle<Address | undefined>>().toEqualTypeOf<ObjectHandle<Address | undefined>>();
    expectTypeOf<FieldHandle<Shape>>().toEqualTypeOf<ObjectHandle<Shape>>();
  });

  it("gives arrays for arrays, including arrays of objects", () => {
    expectTypeOf<FieldHandle<string[]>>().toEqualTypeOf<ArrayHandle<string[]>>();
    expectTypeOf<FieldHandle<Row[]>>().toEqualTypeOf<ArrayHandle<Row[]>>();
    expectTypeOf<FieldHandle<readonly Row[] | undefined>>().toEqualTypeOf<ArrayHandle<readonly Row[] | undefined>>();
  });

  it("gives the loose handle for unknown and any", () => {
    expectTypeOf<FieldHandle<unknown>>().toEqualTypeOf<AnyFieldHandle>();
    // oxlint-disable-next-line typescript/no-explicit-any
    expectTypeOf<FieldHandle<any, string>>().toEqualTypeOf<AnyFieldHandle<string>>();
  });

  it("treats a union of a leaf and an object as a leaf", () => {
    expectTypeOf<FieldHandle<string | Address>>().toEqualTypeOf<LeafHandle<string | Address>>();
  });
});

describe("child handles", () => {

  it("at returns the child handle for the key's type", () => {
    expectTypeOf(profile.at("name")).toEqualTypeOf<LeafHandle<string>>();
    expectTypeOf(profile.at("born")).toEqualTypeOf<LeafHandle<Date>>();
    expectTypeOf(profile.at("address")).toEqualTypeOf<ObjectHandle<Address | undefined>>();
    expectTypeOf(profile.at("rows")).toEqualTypeOf<ArrayHandle<Row[]>>();
  });

  it("children of a missing object read undefined", () => {
    expectTypeOf(profile.at("address").at("city")).toEqualTypeOf<LeafHandle<string | undefined>>();
  });

  it("rejects a key the value doesn't have", () => {
    expectTypeOf<Parameters<ObjectHandle<Profile>["at"]>[0]>().toEqualTypeOf<keyof Profile>();
    // @ts-expect-error: Profile has no key "nope"
    profile.at("nope");
  });

  it("item returns the item handle with its key", () => {
    const row = profile.at("rows").item("k1");
    expectTypeOf(row).toEqualTypeOf<ItemHandle<Row>>();
    expectTypeOf(row.key).toEqualTypeOf<string>();
    expectTypeOf(row.at("title")).toEqualTypeOf<LeafHandle<string>>();
    expectTypeOf(profile.at("tags").item("k2")).toEqualTypeOf<LeafHandle<string> & { readonly key: string }>();
  });

  it("array commands need arrays()", () => {
    const rows = profile.at("rows");
    // @ts-expect-error: Add arrays() to this form's plugins
    rows.push();
    // @ts-expect-error: Add arrays() to this form's plugins
    rows.insert(0);
    // @ts-expect-error: Add arrays() to this form's plugins
    rows.remove(0);
    // @ts-expect-error: Add arrays() to this form's plugins
    rows.move(0, 1);
    // Reading keys and items needs no plugin.
    expectTypeOf(rows.item("k0").key).toEqualTypeOf<string>();
    // A handle of a form with arrays() fits where one without is asked for.
    expectTypeOf(listed.at("rows")).toExtend<ArrayHandle<Row[]>>();
    expectTypeOf(rows).not.toExtend<ArrayHandle<Row[], FormError, "arrays">>();
  });

  it("array commands take the item type", () => {
    const rows = listed.at("rows");
    rows.push();
    rows.push({ title: "a", done: false });
    rows.push(undefined, { edited: false });
    rows.insert(0, { title: "b", done: true });
    // @ts-expect-error: an item needs every key of Row
    rows.push({ title: "a" });
    expectTypeOf(rows.peek().keys).toEqualTypeOf<readonly string[]>();
  });

  it("array commands on a union of literals need the item", () => {
    expectTypeOf<Parameters<typeof channels.push>>().toEqualTypeOf<[item: "email" | "sms", options?: WriteOptions]>();
    expectTypeOf<Parameters<typeof optionalChannels.push>>().toEqualTypeOf<
      [item?: "email" | "sms" | undefined, options?: WriteOptions]
    >();
    channels.push("sms");
    channels.push("email", { edited: false });
    channels.insert(0, "sms");
    // @ts-expect-error: no channel is the empty one, so push needs one
    channels.push();
    // @ts-expect-error: undefined is no channel
    channels.push(undefined);
    // @ts-expect-error: insert needs one too
    channels.insert(0);
    optionalChannels.push();
    nullableChannels.push();
    flags.push();
    emails.push();
  });

  it("object setValue merges a partial and replaces a whole value", () => {
    profile.setValue({ name: "Ada" });
    profile.at("address").setValue({ city: "Paris" });
    profile.at("address").setValue(undefined, { replace: true });
    // @ts-expect-error: replace needs the whole value
    profile.setValue({ name: "Ada" }, { replace: true });
    expectTypeOf<Patch<Profile>>().toEqualTypeOf<Partial<Profile>>();
    expectTypeOf<Patch<Profile | undefined>>().toEqualTypeOf<Partial<Profile>>();
  });

  it("leaf setValue takes a value or an updater", () => {
    const field = profile.at("name");
    field.setValue("Ada");
    field.setValue((previous) => previous.trim(), { edited: false });
    // @ts-expect-error: name is a string
    field.setValue(1);
    expectTypeOf(field.setValue).parameter(0).toEqualTypeOf<string | ((previous: string) => string)>();
  });
});

describe("discriminated unions", () => {

  it("at accepts every member's keys and adds undefined where a member lacks one", () => {
    expectTypeOf(shape.at("kind")).toEqualTypeOf<LeafHandle<"circle" | "square">>();
    expectTypeOf(shape.at("radius")).toEqualTypeOf<LeafHandle<number | undefined>>();
    expectTypeOf(shape.at("side")).toEqualTypeOf<LeafHandle<number | undefined>>();
  });

  it("branch narrows to the matching member", () => {
    const snapshot = shape.peek();
    const circle = branch(shape, snapshot, "kind", "circle");
    expectTypeOf(circle).toEqualTypeOf<ObjectHandle<{ kind: "circle"; radius: number }> | undefined>();
    expectTypeOf(circle?.at("radius")).toEqualTypeOf<LeafHandle<number> | undefined>();
    // @ts-expect-error: "triangle" is not a kind
    branch(shape, snapshot, "kind", "triangle");
  });

  it("branch takes the handle's own snapshot", () => {
    // @ts-expect-error: the snapshot belongs to another value type
    branch(shape, other, "kind", "circle");
    expectTypeOf(other).not.toExtend<FieldSnapshot<Shape>>();
  });
});

describe("scopes", () => {
  it("a handle for a wider object does not fit where a narrower shape is asked for", () => {
    expectTypeOf<ObjectHandle<{ a: string; b: number }>>().not.toExtend<ObjectHandle<{ a: string }>>();
    expectTypeOf<FieldHandle<{ a: string; b: number }>>().not.toExtend<FieldHandle<{ a: string }>>();
    expectTypeOf<FieldHandle<{ inner: { a: string; b: number } }>>().not.toExtend<FieldHandle<{ inner: { a: string } }>>();
    expectTypeOf<FieldHandle<{ rows: { a: string; b: number }[] }>>().not.toExtend<FieldHandle<{ rows: { a: string }[] }>>();
  });

  it("a narrower object does not fit where a wider one is asked for", () => {
    expectTypeOf<ObjectHandle<{ a: string }>>().not.toExtend<ObjectHandle<{ a: string; b: number }>>();
  });

  it("leaf handles are invariant", () => {
    expectTypeOf<LeafHandle<string>>().not.toExtend<LeafHandle<string | undefined>>();
    expectTypeOf<LeafHandle<string | undefined>>().not.toExtend<LeafHandle<string>>();
    expectTypeOf<LeafHandle<"a">>().not.toExtend<LeafHandle<string>>();
  });

  it("an array or nested object with a leaf of the wrong type does not fit", () => {
    expectTypeOf<ArrayHandle<string[]>>().not.toExtend<ArrayHandle<(string | undefined)[]>>();
    expectTypeOf<ArrayHandle<{ a: string }[]>>().not.toExtend<ArrayHandle<{ a: string | undefined }[]>>();
    expectTypeOf<FieldHandle<{ x: { a: string } }>>().not.toExtend<FieldHandle<{ x: { a: string | undefined } }>>();
  });

  it("an object with a leaf of the wrong type does not fit", () => {
    expectTypeOf<ObjectHandle<{ a: string | undefined }>>().not.toExtend<ObjectHandle<{ a: string }>>();
    expectTypeOf<ObjectHandle<{ a: string }>>().not.toExtend<ObjectHandle<{ a: string | undefined }>>();
  });

  it("every handle fits HandleBase of unknown", () => {
    expectTypeOf<LeafHandle<string>>().toExtend<HandleBase<unknown>>();
    expectTypeOf<ArrayHandle<Row[]>>().toExtend<HandleBase<unknown>>();
    expectTypeOf<ObjectHandle<Shape>>().toExtend<HandleBase<unknown>>();
  });
});

describe("ValueOf and ErrorOf", () => {
  it("recover the value and error types", () => {
    expectTypeOf<ValueOf<LeafHandle<string>>>().toEqualTypeOf<string>();
    expectTypeOf<ErrorOf<LeafHandle<string>>>().toEqualTypeOf<FormError>();
    expectTypeOf<ValueOf<FieldHandle<Row[], "required">>>().toEqualTypeOf<Row[]>();
    expectTypeOf<ErrorOf<FieldHandle<Row[], "required">>>().toEqualTypeOf<"required">();
    expectTypeOf<ValueOf<ItemHandle<Row>>>().toEqualTypeOf<Row>();
    expectTypeOf<ValueOf<AnyFieldHandle>>().toEqualTypeOf<unknown>();
  });
});

describe("handle commands", () => {

  it("peek returns the snapshot, the other members return nothing", () => {
    expectTypeOf(nameHandle.peek()).toEqualTypeOf<FieldSnapshot<string, { code: string }>>();
    expectTypeOf(nameHandle.handleBlur()).toEqualTypeOf<void>();
    expectTypeOf(nameHandle.setTouched()).toEqualTypeOf<void>();
    expectTypeOf(nameHandle.validate()).toEqualTypeOf<Promise<boolean>>();
    expectTypeOf(nameHandle.id).toEqualTypeOf<string>();
  });

  it("setTouched takes an optional boolean on every handle kind", () => {
    nameHandle.setTouched();
    nameHandle.setTouched(false);
    expectTypeOf<(typeof nameHandle)["setTouched"]>().parameter(0).toEqualTypeOf<boolean | undefined>();
    expectTypeOf<HandleBase<number>["setTouched"]>().parameter(0).toEqualTypeOf<boolean | undefined>();
    expectTypeOf<AnyFieldHandle["setTouched"]>().parameter(0).toEqualTypeOf<boolean | undefined>();
    expectTypeOf<FieldHandle<Row[]>["setTouched"]>().returns.toEqualTypeOf<void>();
    // @ts-expect-error: the flag is a boolean
    nameHandle.setTouched("yes");
  });

  it("setErrors takes one error or a list of the form's error type", () => {
    nameHandle.setErrors({ code: "taken" });
    nameHandle.setErrors([{ code: "a" }, { code: "b" }]);
    // @ts-expect-error: the error type has no message
    nameHandle.setErrors({ message: "x" });
    expectTypeOf<Parameters<typeof nameHandle.setErrors>[0]>().toEqualTypeOf<{ code: string } | readonly { code: string }[]>();
  });

  it("registerValidator takes a validator for the field's value", () => {
    const remove = nameHandle.registerValidator((value) => (value.length > 3 ? undefined : { code: "short" }));
    expectTypeOf(remove).toEqualTypeOf<() => void>();
    // @ts-expect-error: the field holds a string
    nameHandle.registerValidator((value: number) => (value > 0 ? undefined : { code: "neg" }));
  });
});

declare const takesList: (list: string[]) => number;

describe("writing back a value read from a snapshot", () => {
  const store = createFormsCore({ plugins: [arrays()] })
    .define({ defaultValues: { name: "", tags: ["a"], address: { street: "", city: "" }, rows: [{ title: "", done: false }] } })
    .createStore();
  const tags = store.root.at("tags");
  const address = store.root.at("address");
  const rows = store.root.at("rows");

  it("takes the readonly values peek returns", () => {
    tags.setValue(tags.peek().value);
    store.root.setValue(store.root.peek().value, { replace: true });
    store.root.setValue({ address: address.peek().value, tags: tags.peek().value });
    address.setValue(address.peek().value, { replace: true });
    rows.setValue(rows.peek().value);
    const [first] = rows.peek().value;
    if (first) {
      rows.push(first);
      rows.insert(0, first, { edited: false });
    }
    profile.at("rows").setValue(profile.peek().value.rows);
    profile.at("address").setValue(profile.peek().value.address, { replace: true });
    expectTypeOf(tags.peek().value).toEqualTypeOf<readonly string[]>();
    expectTypeOf(tags.peek().value).toExtend<Parameters<typeof tags.setValue>[0]>();
  });

  it("leaves inference from defaultValues as it was", () => {
    expectTypeOf(store.root).toEqualTypeOf<
      ObjectHandle<{ name: string; tags: string[]; address: { street: string; city: string }; rows: { title: string; done: boolean }[] }, FormError, "arrays">
    >();
    expectTypeOf(rows.item("k")).toEqualTypeOf<ItemHandle<{ title: string; done: boolean }, FormError, "arrays">>();
  });

  it("still checks object literals", () => {
    address.setValue({ city: "Paris" });
    rows.push({ title: "a", done: false });
    // @ts-expect-error: address has no zip
    address.setValue({ city: "Paris", zip: "75001" });
    // @ts-expect-error: city is a string
    address.setValue({ city: 75001 });
    // @ts-expect-error: address has no zip
    address.setValue({ street: "", city: "", zip: "" }, { replace: true });
    // @ts-expect-error: a row has no note
    rows.push({ title: "a", done: false, note: "" });
    // @ts-expect-error: done is a boolean
    rows.insert(0, { title: "a", done: "no" });
    // @ts-expect-error: tags holds strings
    tags.setValue([1]);
    expectTypeOf<{ readonly title: string; readonly done: boolean }>().toExtend<Parameters<typeof rows.push>[0]>();
    expectTypeOf<{ readonly title: string }>().not.toExtend<Parameters<typeof rows.push>[0]>();
    expectTypeOf<readonly number[]>().not.toExtend<Parameters<typeof tags.setValue>[0]>();
  });

  it("does not make a readonly value fit a mutable parameter", () => {
    // @ts-expect-error: the snapshot's array is readonly, so the helper's signature has to say so
    takesList(tags.peek().value);
    expectTypeOf(tags.peek().value).not.toExtend<string[]>();
  });
});

interface Tag {
  id: number;
  name: string;
}

interface WideTag extends Tag {
  enabled: boolean;
}

describe("writes are strict in the value type", () => {
  const store = createFormsCore({ plugins: [arrays()] })
    .define<{ tags: WideTag[]; one: WideTag }>({ defaultValues: { tags: [], one: { id: 0, name: "", enabled: true } } })
    .createStore();

  it("a narrow array handle does not take the form's wider one", () => {
    // Its push and setValue would store items without `enabled`.
    expectTypeOf(store.root.at("tags")).not.toExtend<ArrayHandle<Tag[], FormError, "arrays">>();
    expectTypeOf(store.root.at("tags")).not.toExtend<ArrayHandle<Tag[]>>();
    expectTypeOf<ArrayHandle<WideTag[]>>().not.toExtend<ArrayHandle<Tag[]>>();
  });

  it("a narrow object or item handle does not take a wider one", () => {
    expectTypeOf(store.root.at("one")).not.toExtend<ObjectHandle<Tag, FormError, "arrays">>();
    expectTypeOf(store.root.at("tags").item("k")).not.toExtend<ObjectHandle<Tag, FormError, "arrays">>();
    expectTypeOf<ItemHandle<WideTag>>().not.toExtend<ItemHandle<Tag>>();
  });

  it("a handle of a form with more plugins still fits one asking for fewer", () => {
    expectTypeOf<ArrayHandle<WideTag[], FormError, "arrays" | "dirty">>().toExtend<ArrayHandle<WideTag[], FormError, "arrays">>();
    expectTypeOf<ObjectHandle<WideTag, FormError, "arrays" | "dirty">>().toExtend<ObjectHandle<WideTag>>();
    expectTypeOf(store.root.at("tags")).toExtend<ArrayHandle<WideTag[]>>();
    expectTypeOf<ArrayHandle<WideTag[]>>().not.toExtend<ArrayHandle<WideTag[], FormError, "arrays">>();
  });

  it("unions keep one handle for the whole value", () => {
    expectTypeOf<FieldHandle<boolean>>().toEqualTypeOf<LeafHandle<boolean>>();
    expectTypeOf<FieldHandle<undefined>>().toEqualTypeOf<LeafHandle<undefined>>();
    expectTypeOf<FieldHandle<null | undefined>>().toEqualTypeOf<LeafHandle<null | undefined>>();
    expectTypeOf<FieldHandle<string[] | undefined>>().toEqualTypeOf<ArrayHandle<string[] | undefined>>();
    expectTypeOf<FieldHandle<Address | Row[]>>().toEqualTypeOf<ObjectHandle<Address | Row[]>>();
    expectTypeOf<FieldHandle<string[] | number>>().toEqualTypeOf<LeafHandle<string[] | number>>();
  });
});

// A reusable list, generic in its item type so it takes items with more keys.
function tagList<T extends Tag>(tags: ArrayHandle<T[], FormError, "arrays">, create: (base: Tag) => T) {
  const tag = tags.item("k");
  // Children that T's constraint names read as the constraint's types. These
  // are plain assignments: expectTypeOf can't check a type that depends on T.
  const name: LeafHandle<string, FormError, "arrays"> = tag.at("name");
  const id: FieldHandle<number> = tag.at("id");
  const same: ObjectHandle<T, FormError, "arrays"> = tag;
  tags.push(create({ id: 1, name: "a" }));
  // @ts-expect-error: a Tag may lack T's other keys
  tags.push({ id: 1, name: "a" });
  // @ts-expect-error: so may a whole value
  tag.setValue({ id: 1, name: "a" }, { replace: true });
  return [name, id, same];
}

describe("generic components", () => {
  it("take handles of wider items and read the children their constraint names", () => {
    const store = createFormsCore({ plugins: [arrays()] })
      .define<{ tags: WideTag[] }>({ defaultValues: { tags: [] } })
      .createStore();
    expectTypeOf(tagList(store.root.at("tags"), (base) => ({ ...base, enabled: true }))).toBeArray();
    // @ts-expect-error: create has to return the form's item type
    tagList(store.root.at("tags"), (base) => base);
  });
});
