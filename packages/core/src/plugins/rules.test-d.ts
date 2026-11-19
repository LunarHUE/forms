import { type RuleFields, rules, type RulesMeta, type RulesNeedValueType, type RulesPlugin } from "@lunarhue/forms-core/plugins";
import { describe, expectTypeOf, it } from "vitest";
import { createFormsCore } from "../index.js";

interface Order {
  pickup: boolean;
  address: { street: string; city: string };
  items: { name: string }[];
}

const order: Order = { pickup: false, address: { street: "", city: "" }, items: [] };
const forms = createFormsCore();

describe("rules types", () => {
  it("takes the dotted names of the value's fields, nested ones included", () => {
    expectTypeOf(rules<Order>({ "address.street": (value) => ({ disabled: value.pickup }) })).toEqualTypeOf<RulesPlugin<Order>>();
    rules<Order>({ address: () => ({ disabled: true }), items: (value) => ({ hidden: value.items.length === 0 }) });
    // @ts-expect-error: no field is named "address.stret"
    rules<Order>({ "address.stret": (value) => ({ disabled: value.pickup }) });
    // @ts-expect-error: no field is named "stret"
    rules<Order>({ stret: (value) => ({ disabled: value.pickup }) });
  });

  it("stops names at an array, as name props do", () => {
    expectTypeOf<keyof RuleFields<Order>>().toEqualTypeOf<"pickup" | "address" | "address.street" | "address.city" | "items">();
    // @ts-expect-error: an array item has no dotted name
    rules<Order>({ "items.0.name": () => ({ hidden: true }) });
  });

  it("reads meta with no undefined, for a field no rule names too", () => {
    const deliveryRules = rules<Order>({ pickup: () => ({ hidden: true }) });
    const store = forms.define({ defaultValues: order, plugins: [deliveryRules] }).createStore();
    expectTypeOf(deliveryRules.meta(store.getSnapshot(["address", "city"]))).toEqualTypeOf<RulesMeta>();
    expectTypeOf(deliveryRules.meta({}).hidden).toEqualTypeOf<boolean>();
  });

  it("gives each rule the value as a V", () => {
    rules<Order>({
      pickup: (value) => {
        expectTypeOf(value).toEqualTypeOf<Order>();
        return {};
      },
    });
  });

  it("needs V", () => {
    expectTypeOf<RuleFields<unknown>>().toEqualTypeOf<RulesNeedValueType>();
    // @ts-expect-error: without V the rules can't be checked
    rules({ pickup: () => ({ disabled: true }) });
  });

  it("installs on a form whose value is a V", () => {
    forms.define({ defaultValues: order, plugins: [rules<Order>({ "address.city": (value) => ({ disabled: value.pickup }) })] });
    const delivery = forms.define({ defaultValues: { pickup: false, address: { street: "", city: "" } } });
    // A form with fields V doesn't name still fits: every name in V is one of its fields.
    forms.define({ defaultValues: { ...order, note: "" }, plugins: [rules<Order>({ pickup: () => ({}) })] });
    forms.define({
      defaultValues: { pickup: false },
      // @ts-expect-error: the form has no address, so it isn't an Order
      plugins: [rules<Order>({ "address.city": (value) => ({ disabled: value.pickup }) })],
    });
    // @ts-expect-error: the function form is checked too, with the error on the function
    forms.define((pickup: boolean) => ({
      defaultValues: { pickup, address: { city: "" } },
      plugins: [rules<Order>({ pickup: () => ({}) })],
    }));
    expectTypeOf(delivery.createStore(undefined, { plugins: [rules<Omit<Order, "items">>({ pickup: () => ({}) })] }).id).toBeString();
    // @ts-expect-error: a store's own plugins are checked against its value too
    delivery.createStore(undefined, { plugins: [rules<Order>({ pickup: () => ({}) })] });
  });
});
