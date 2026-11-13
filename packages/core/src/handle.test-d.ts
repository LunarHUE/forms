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
} from "./index.js";

interface Address {
  street: string;
  city: string;
}

interface Row {
  title: string;
  done: boolean;
}

type Shape = { kind: "circle"; radius: number } | { kind: "square"; side: number };

interface Profile {
  name: string;
  born: Date;
  address?: Address;
  rows: Row[];
  tags: string[];
}

declare const profile: ObjectHandle<Profile>;
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

  it("array commands take the item type", () => {
    const rows = profile.at("rows");
    rows.push();
    rows.push({ title: "a", done: false });
    rows.push(undefined, { edited: false });
    rows.insert(0, { title: "b", done: true });
    // @ts-expect-error: an item needs every key of Row
    rows.push({ title: "a" });
    expectTypeOf(rows.peek().keys).toEqualTypeOf<readonly string[]>();
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
  it("a handle for a wider object fits where a narrower shape is asked for", () => {
    expectTypeOf<ObjectHandle<{ a: string; b: number }>>().toExtend<ObjectHandle<{ a: string }>>();
    expectTypeOf<FieldHandle<{ a: string; b: number }>>().toExtend<FieldHandle<{ a: string }>>();
    expectTypeOf<FieldHandle<{ inner: { a: string; b: number } }>>().toExtend<FieldHandle<{ inner: { a: string } }>>();
    expectTypeOf<FieldHandle<{ rows: { a: string; b: number }[] }>>().toExtend<FieldHandle<{ rows: { a: string }[] }>>();
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
    expectTypeOf(nameHandle.validate()).toEqualTypeOf<Promise<boolean>>();
    expectTypeOf(nameHandle.id).toEqualTypeOf<string>();
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
