import { type RuleFields, ruled, rules, type RulesMeta } from "@lunarhue/forms-core/plugins";
import type { Part } from "@lunarhue/forms-core";
import { describe, expectTypeOf, it } from "vitest";
import { createFormsCore } from "../index.js";

interface Order {
  pickup: boolean;
  address: { street: string; city: string };
  items: { name: string }[];
}

const order: Order = { pickup: false, address: { street: "", city: "" }, items: [] };
const forms = createFormsCore({ plugins: [rules()] });

describe("ruled types", () => {
  it("takes the dotted names of the value's fields, nested ones included", () => {
    expectTypeOf(ruled<Order>({ "address.street": (value) => ({ disabled: value.pickup }) })).toEqualTypeOf<Part<typeof rules, Order>>();
    ruled<Order>({ address: () => ({ disabled: true }), items: (value) => ({ hidden: value.items.length === 0 }) });
    // @ts-expect-error: no field is named "address.stret"
    ruled<Order>({ "address.stret": (value) => ({ disabled: value.pickup }) });
  });

  it("stops names at an array, as name props do", () => {
    expectTypeOf<keyof RuleFields<Order>>().toEqualTypeOf<"pickup" | "address" | "address.street" | "address.city" | "items">();
    // @ts-expect-error: an array item has no dotted name
    ruled<Order>({ "items.0.name": () => ({ hidden: true }) });
  });

  it("reads meta with no undefined, for a field no rule names too", () => {
    const store = forms.define({ defaultValues: order }).createStore();
    expectTypeOf(rules.meta(store.getSnapshot(["address", "city"]))).toEqualTypeOf<RulesMeta>();
    expectTypeOf(rules.meta({}).hidden).toEqualTypeOf<boolean>();
  });

  it("types each rule's value from the definition it goes after, with no type argument", () => {
    forms.define(
      { defaultValues: order, onSubmit: (value) => void value.pickup },
      ruled({
        pickup: (value) => {
          expectTypeOf(value).toEqualTypeOf<Order>();
          return {};
        },
      }),
    );
    forms.define(
      { defaultValues: order },
      // @ts-expect-error: no field is named "stret"
      ruled({ stret: () => ({}) }),
    );
  });

  it("needs rules() on the form", () => {
    expectTypeOf(ruled<Order>({})).toExtend<Part<typeof rules, Order>>();
    createFormsCore().define(
      { defaultValues: order },
      // @ts-expect-error: the form has no rules()
      ruled({ pickup: () => ({}) }),
    );
  });
});
