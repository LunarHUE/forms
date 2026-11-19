import { describe, expectTypeOf, it } from "vitest";
import type { DeepReadonly, FieldSnapshot, FormError, FormSnapshot, Submission } from "./index.js";

interface Value {
  name: string;
  born: Date;
  tags: Set<string>;
  address: { city: string };
  rows: { title: string }[];
}

declare const snapshot: FieldSnapshot<Value>;
declare const rows: FieldSnapshot<Value["rows"]>;
declare const loose: FieldSnapshot<unknown>;
declare const form: FormSnapshot<"save", number>;

describe("FieldSnapshot", () => {
  it("is deeply readonly", () => {
    // @ts-expect-error: snapshot members are readonly
    snapshot.touched = true;
    // @ts-expect-error: the value is readonly
    snapshot.value.name = "x";
    // @ts-expect-error: nested objects are readonly
    snapshot.value.address.city = "x";
    // @ts-expect-error: arrays are readonly
    snapshot.value.rows.push({ title: "x" });
    // @ts-expect-error: array items are readonly
    snapshot.value.rows[0]!.title = "x";
    // @ts-expect-error: the error list is readonly
    snapshot.errors.push({ message: "x" });
    expectTypeOf(snapshot.value.rows).toEqualTypeOf<readonly { readonly title: string }[]>();
    expectTypeOf(snapshot.value.address).toEqualTypeOf<{ readonly city: string }>();
  });

  it("leaves Date, Set and Map alone", () => {
    expectTypeOf(snapshot.value.born).toEqualTypeOf<Date>();
    expectTypeOf(snapshot.value.tags).toEqualTypeOf<Set<string>>();
    expectTypeOf<DeepReadonly<Map<string, number>>>().toEqualTypeOf<Map<string, number>>();
    expectTypeOf<DeepReadonly<string | undefined>>().toEqualTypeOf<string | undefined>();
    expectTypeOf<DeepReadonly<unknown>>().toEqualTypeOf<unknown>();
  });

  it("has keys on array fields only", () => {
    expectTypeOf(rows.keys).toEqualTypeOf<readonly string[]>();
    expectTypeOf(loose.keys).toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf(snapshot).not.toHaveProperty("keys");
  });

  it("has the documented members", () => {
    expectTypeOf(snapshot.name).toEqualTypeOf<string>();
    expectTypeOf(snapshot.errors).toEqualTypeOf<readonly FormError[]>();
    expectTypeOf(snapshot.shownErrors).toEqualTypeOf<readonly FormError[]>();
    expectTypeOf(snapshot.invalid).toEqualTypeOf<boolean>();
    expectTypeOf<FieldSnapshot<Value, FormError, "dirty">["dirty"]>().toEqualTypeOf<boolean>();
    expectTypeOf(snapshot.validating).toEqualTypeOf<boolean>();
    expectTypeOf(snapshot.disabled).toEqualTypeOf<boolean>();
    expectTypeOf(snapshot.readOnly).toEqualTypeOf<boolean>();
  });
});

describe("FormSnapshot and Submission", () => {
  it("carries the intent and result types", () => {
    expectTypeOf(form.submission).toEqualTypeOf<Submission<"save", number>>();
    // @ts-expect-error: form snapshot members are readonly
    form.submitCount = 1;
  });

  it("narrows by status", () => {
    type Of<S extends Submission<"save", number>["status"]> = Extract<Submission<"save", number>, { status: S }>;
    expectTypeOf<Of<"succeeded">["result"]>().toEqualTypeOf<number>();
    expectTypeOf<Of<"submitting">["intent"]>().toEqualTypeOf<"save">();
    expectTypeOf<Of<"failed">["error"]>().toEqualTypeOf<unknown>();
    expectTypeOf<Of<"idle">>().toEqualTypeOf<{ readonly status: "idle" }>();
  });
});
