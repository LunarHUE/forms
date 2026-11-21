import { describe, expectTypeOf, it } from "vitest";
import type {
  AnyFieldHandle,
  NamedAnyFieldHandle,
  ArrayHandle,
  NamedArrayHandle,
  Branch,
  ErrorOf,
  FieldHandle,
  NamedFieldHandle,
  FieldSnapshot,
  FormError,
  HandleBase,
  ItemHandle,
  NamedItemHandle,
  LeafHandle,
  NamedLeafHandle,
  ObjectHandle,
  NamedObjectHandle,
  Patch,
  ValueOf,
  WriteOptions,
} from "./index.js";
import { createFormsCore } from "./index.js";
import { arrays } from "./plugins/arrays.js";
import { dirty } from "./plugins/dirty.js";

interface Address {
  street: string;
  city: string;
}

interface Row {
  title: string;
  done: boolean;
}

declare const channels: NamedArrayHandle<("email" | "sms")[], FormError, "arrays">;
declare const optionalChannels: NamedArrayHandle<("email" | "sms" | undefined)[], FormError, "arrays">;
declare const nullableChannels: NamedArrayHandle<("email" | "sms" | null)[], FormError, "arrays">;
declare const flags: NamedArrayHandle<boolean[], FormError, "arrays">;
declare const emails: NamedArrayHandle<"email"[], FormError, "arrays">;

type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };

interface Profile {
  name: string;
  born: Date;
  address?: Address;
  rows: Row[];
  tags: string[];
}

declare const profile: NamedObjectHandle<Profile>;
declare const listed: NamedObjectHandle<Profile, FormError, "arrays">;
declare const shape: NamedObjectHandle<Shape>;
declare const branch: Branch;
declare const other: FieldSnapshot<Address>;
declare const nameHandle: NamedLeafHandle<string, { code: string }>;

describe("FieldHandle picks the handle from the value type", () => {
  it("gives leaves for primitives, Date, Map, Set and functions", () => {
    expectTypeOf<NamedFieldHandle<string>>().toEqualTypeOf<NamedLeafHandle<string>>();
    expectTypeOf<NamedFieldHandle<number | undefined>>().toEqualTypeOf<NamedLeafHandle<number | undefined>>();
    expectTypeOf<NamedFieldHandle<Date>>().toEqualTypeOf<NamedLeafHandle<Date>>();
    expectTypeOf<NamedFieldHandle<Date | null>>().toEqualTypeOf<NamedLeafHandle<Date | null>>();
    expectTypeOf<NamedFieldHandle<Map<string, number>>>().toEqualTypeOf<NamedLeafHandle<Map<string, number>>>();
    expectTypeOf<NamedFieldHandle<Set<string>>>().toEqualTypeOf<NamedLeafHandle<Set<string>>>();
    expectTypeOf<NamedFieldHandle<() => void>>().toEqualTypeOf<NamedLeafHandle<() => void>>();
    expectTypeOf<NamedFieldHandle<"a" | "b">>().toEqualTypeOf<NamedLeafHandle<"a" | "b">>();
  });

  it("gives objects for plain objects, optional or not", () => {
    expectTypeOf<NamedFieldHandle<Address>>().toEqualTypeOf<NamedObjectHandle<Address>>();
    expectTypeOf<NamedFieldHandle<Address | undefined>>().toEqualTypeOf<NamedObjectHandle<Address | undefined>>();
    expectTypeOf<NamedFieldHandle<Shape>>().toEqualTypeOf<NamedObjectHandle<Shape>>();
  });

  it("gives arrays for arrays, including arrays of objects", () => {
    expectTypeOf<NamedFieldHandle<string[]>>().toEqualTypeOf<NamedArrayHandle<string[]>>();
    expectTypeOf<NamedFieldHandle<Row[]>>().toEqualTypeOf<NamedArrayHandle<Row[]>>();
    expectTypeOf<NamedFieldHandle<readonly Row[] | undefined>>().toEqualTypeOf<NamedArrayHandle<readonly Row[] | undefined>>();
  });

  it("gives the loose handle for unknown and any", () => {
    expectTypeOf<NamedFieldHandle<unknown>>().toEqualTypeOf<AnyFieldHandle>();
    // oxlint-disable-next-line typescript/no-explicit-any
    expectTypeOf<NamedFieldHandle<any, string>>().toEqualTypeOf<NamedAnyFieldHandle<string>>();
  });

  it("treats a union of a leaf and an object as a leaf", () => {
    expectTypeOf<NamedFieldHandle<string | Address>>().toEqualTypeOf<NamedLeafHandle<string | Address>>();
  });
});

describe("child handles", () => {

  it("at returns the child handle for the key's type", () => {
    expectTypeOf(profile.at("name")).toEqualTypeOf<NamedLeafHandle<string>>();
    expectTypeOf(profile.at("born")).toEqualTypeOf<NamedLeafHandle<Date>>();
    expectTypeOf(profile.at("address")).toEqualTypeOf<NamedObjectHandle<Address | undefined>>();
    expectTypeOf(profile.at("rows")).toEqualTypeOf<NamedArrayHandle<Row[]>>();
  });

  it("children of a missing object read undefined", () => {
    expectTypeOf(profile.at("address").at("city")).toEqualTypeOf<NamedLeafHandle<string | undefined>>();
  });

  it("rejects a key the value doesn't have", () => {
    expectTypeOf<Parameters<NamedObjectHandle<Profile>["at"]>[0]>().toEqualTypeOf<keyof Profile>();
    // @ts-expect-error: Profile has no key "nope"
    profile.at("nope");
  });

  it("item returns the item handle with its key", () => {
    const row = profile.at("rows").item("k1");
    expectTypeOf(row).toEqualTypeOf<NamedItemHandle<Row>>();
    expectTypeOf(row.key).toEqualTypeOf<string>();
    expectTypeOf(row.at("title")).toEqualTypeOf<NamedLeafHandle<string>>();
    expectTypeOf(profile.at("tags").item("k2")).toEqualTypeOf<NamedLeafHandle<string> & { readonly key: string }>();
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
    expectTypeOf(listed.at("rows")).toExtend<NamedArrayHandle<Row[]>>();
    expectTypeOf(rows).not.toExtend<NamedArrayHandle<Row[], FormError, "arrays">>();
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
    expectTypeOf(shape.at("kind")).toEqualTypeOf<NamedLeafHandle<"circle" | "square">>();
    expectTypeOf(shape.at("radius")).toEqualTypeOf<NamedLeafHandle<number | undefined>>();
    expectTypeOf(shape.at("side")).toEqualTypeOf<NamedLeafHandle<number | undefined>>();
  });

  it("branch narrows to the matching member", () => {
    const snapshot = shape.peek();
    const circle = branch(shape, snapshot, "kind", "circle");
    expectTypeOf(circle).toEqualTypeOf<NamedObjectHandle<{ kind: "circle"; radius: number }> | undefined>();
    expectTypeOf(circle?.at("radius")).toEqualTypeOf<NamedLeafHandle<number> | undefined>();
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
    expectTypeOf<NamedObjectHandle<{ a: string; b: number }>>().not.toExtend<NamedObjectHandle<{ a: string }>>();
    expectTypeOf<NamedFieldHandle<{ a: string; b: number }>>().not.toExtend<NamedFieldHandle<{ a: string }>>();
    expectTypeOf<NamedFieldHandle<{ inner: { a: string; b: number } }>>().not.toExtend<NamedFieldHandle<{ inner: { a: string } }>>();
    expectTypeOf<NamedFieldHandle<{ rows: { a: string; b: number }[] }>>().not.toExtend<NamedFieldHandle<{ rows: { a: string }[] }>>();
  });

  it("a narrower object does not fit where a wider one is asked for", () => {
    expectTypeOf<NamedObjectHandle<{ a: string }>>().not.toExtend<NamedObjectHandle<{ a: string; b: number }>>();
  });

  it("leaf handles are invariant", () => {
    expectTypeOf<NamedLeafHandle<string>>().not.toExtend<NamedLeafHandle<string | undefined>>();
    expectTypeOf<NamedLeafHandle<string | undefined>>().not.toExtend<NamedLeafHandle<string>>();
    expectTypeOf<NamedLeafHandle<"a">>().not.toExtend<NamedLeafHandle<string>>();
  });

  it("an array or nested object with a leaf of the wrong type does not fit", () => {
    expectTypeOf<NamedArrayHandle<string[]>>().not.toExtend<NamedArrayHandle<(string | undefined)[]>>();
    expectTypeOf<NamedArrayHandle<{ a: string }[]>>().not.toExtend<NamedArrayHandle<{ a: string | undefined }[]>>();
    expectTypeOf<NamedFieldHandle<{ x: { a: string } }>>().not.toExtend<NamedFieldHandle<{ x: { a: string | undefined } }>>();
  });

  it("an object with a leaf of the wrong type does not fit", () => {
    expectTypeOf<NamedObjectHandle<{ a: string | undefined }>>().not.toExtend<NamedObjectHandle<{ a: string }>>();
    expectTypeOf<NamedObjectHandle<{ a: string }>>().not.toExtend<NamedObjectHandle<{ a: string | undefined }>>();
  });

  it("every handle fits HandleBase of unknown", () => {
    expectTypeOf<NamedLeafHandle<string>>().toExtend<HandleBase<unknown>>();
    expectTypeOf<NamedArrayHandle<Row[]>>().toExtend<HandleBase<unknown>>();
    expectTypeOf<NamedObjectHandle<Shape>>().toExtend<HandleBase<unknown>>();
  });
});

describe("ValueOf and ErrorOf", () => {
  it("recover the value and error types", () => {
    expectTypeOf<ValueOf<NamedLeafHandle<string>>>().toEqualTypeOf<string>();
    expectTypeOf<ErrorOf<NamedLeafHandle<string>>>().toEqualTypeOf<FormError>();
    expectTypeOf<ValueOf<NamedFieldHandle<Row[], "required">>>().toEqualTypeOf<Row[]>();
    expectTypeOf<ErrorOf<NamedFieldHandle<Row[], "required">>>().toEqualTypeOf<"required">();
    expectTypeOf<ValueOf<NamedItemHandle<Row>>>().toEqualTypeOf<Row>();
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
    expectTypeOf<NamedFieldHandle<Row[]>["setTouched"]>().returns.toEqualTypeOf<void>();
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
      NamedObjectHandle<{ name: string; tags: string[]; address: { street: string; city: string }; rows: { title: string; done: boolean }[] }, FormError, "arrays">
    >();
    expectTypeOf(rows.item("k")).toEqualTypeOf<NamedItemHandle<{ title: string; done: boolean }, FormError, "arrays">>();
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
    expectTypeOf(store.root.at("tags")).not.toExtend<NamedArrayHandle<Tag[], FormError, "arrays">>();
    expectTypeOf(store.root.at("tags")).not.toExtend<NamedArrayHandle<Tag[]>>();
    expectTypeOf<NamedArrayHandle<WideTag[]>>().not.toExtend<NamedArrayHandle<Tag[]>>();
  });

  it("a narrow object or item handle does not take a wider one", () => {
    expectTypeOf(store.root.at("one")).not.toExtend<NamedObjectHandle<Tag, FormError, "arrays">>();
    expectTypeOf(store.root.at("tags").item("k")).not.toExtend<NamedObjectHandle<Tag, FormError, "arrays">>();
    expectTypeOf<NamedItemHandle<WideTag>>().not.toExtend<NamedItemHandle<Tag>>();
  });

  it("a handle of a form with more plugins still fits one asking for fewer", () => {
    expectTypeOf<NamedArrayHandle<WideTag[], FormError, "arrays" | "dirty">>().toExtend<NamedArrayHandle<WideTag[], FormError, "arrays">>();
    expectTypeOf<NamedObjectHandle<WideTag, FormError, "arrays" | "dirty">>().toExtend<NamedObjectHandle<WideTag>>();
    expectTypeOf(store.root.at("tags")).toExtend<NamedArrayHandle<WideTag[]>>();
    expectTypeOf<NamedArrayHandle<WideTag[]>>().not.toExtend<NamedArrayHandle<WideTag[], FormError, "arrays">>();
  });

  it("unions keep one handle for the whole value", () => {
    expectTypeOf<NamedFieldHandle<boolean>>().toEqualTypeOf<NamedLeafHandle<boolean>>();
    expectTypeOf<NamedFieldHandle<undefined>>().toEqualTypeOf<NamedLeafHandle<undefined>>();
    expectTypeOf<NamedFieldHandle<null | undefined>>().toEqualTypeOf<NamedLeafHandle<null | undefined>>();
    expectTypeOf<NamedFieldHandle<string[] | undefined>>().toEqualTypeOf<NamedArrayHandle<string[] | undefined>>();
    expectTypeOf<NamedFieldHandle<Address | Row[]>>().toEqualTypeOf<NamedObjectHandle<Address | Row[]>>();
    expectTypeOf<NamedFieldHandle<string[] | number>>().toEqualTypeOf<NamedLeafHandle<string[] | number>>();
  });
});

// A reusable list, generic in its item type so it takes items with more keys.
function tagList<T extends Tag>(tags: ArrayHandle<T[], typeof arrays>, create: (base: Tag) => T) {
  const tag = tags.item("k");
  // Children that T's constraint names read as the constraint's types. These
  // are plain assignments: expectTypeOf can't check a type that depends on T.
  const name: LeafHandle<string, typeof arrays> = tag.at("name");
  const id: FieldHandle<number> = tag.at("id");
  const same: ObjectHandle<T, typeof arrays> = tag;
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

describe("handle types written by hand", () => {
  it("take the plugins by factory and the error type last", () => {
    type Error = { readonly code: string };
    expectTypeOf<ArrayHandle<string[], typeof arrays>>().toEqualTypeOf<NamedArrayHandle<string[], FormError, "arrays">>();
    expectTypeOf<ObjectHandle<Profile, typeof arrays | typeof dirty, Error>>().toEqualTypeOf<
      NamedObjectHandle<Profile, Error, "arrays" | "dirty">
    >();
    expectTypeOf<LeafHandle<string, typeof dirty>>().toEqualTypeOf<NamedLeafHandle<string, FormError, "dirty">>();
    expectTypeOf<ItemHandle<string, typeof arrays>>().toEqualTypeOf<NamedItemHandle<string, FormError, "arrays">>();
    expectTypeOf<FieldHandle<string[], typeof arrays>>().toEqualTypeOf<NamedFieldHandle<string[], FormError, "arrays">>();
    expectTypeOf<AnyFieldHandle<typeof arrays, Error>>().toEqualTypeOf<NamedAnyFieldHandle<Error, "arrays">>();
    expectTypeOf<ArrayHandle<string[]>>().toEqualTypeOf<NamedArrayHandle<string[]>>();
  });
});
