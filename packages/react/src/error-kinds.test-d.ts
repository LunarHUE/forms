import { describe, expectTypeOf, it } from "vitest";
import { createFormsCore, type ErrorsByKind, errorsByKind, type ValidatorKind } from "./index.js";

describe("errorsByKind", () => {
  it("is re-exported from core, typed by the store's error type, `FormError` by default", () => {
    const store = createFormsCore().define({ defaultValues: { name: "" } }).createStore();
    expectTypeOf(errorsByKind(store.root.at("name"))).toEqualTypeOf<ErrorsByKind>();
    expectTypeOf<keyof ErrorsByKind>().toEqualTypeOf<ValidatorKind>();
  });
});
