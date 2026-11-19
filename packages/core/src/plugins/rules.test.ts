import { describe, expect, it } from "vitest";
import { attach } from "../attach.js";
import { ruled, rules } from "./rules.js";
import { testStore } from "./testing.js";

interface Order {
  sameAsBilling: boolean;
  shipping: { street: string };
}

const order = (): Order => ({ sameAsBilling: true, shipping: { street: "" } });
const shippingRules = () => ruled<Order>({ shipping: (value) => ({ disabled: value.sameAsBilling, hidden: value.sameAsBilling }) });

describe("rules", () => {
  it("derives disabled and hidden from the value before listeners run", () => {
    const { store, errors } = testStore({ defaultValues: order(), plugins: [rules()] }, shippingRules());
    const seen: unknown[] = [];
    store.subscribe(["shipping"], () => {
      const snapshot = store.getSnapshot(["shipping"]);
      seen.push({ disabled: snapshot.disabled, hidden: rules.meta(snapshot).hidden });
    });
    store.root.at("sameAsBilling").setValue(false);
    expect(seen).toEqual([{ disabled: false, hidden: false }]);
    expect(errors).toEqual([]);
  });

  it("puts what it sets at setup in the server snapshots, the same on every store", () => {
    const { server } = testStore({ defaultValues: order(), plugins: [rules()] }, shippingRules());
    const { fields } = server();
    expect(fields["shipping"]).toMatchObject({ disabled: true, meta: { rules: { hidden: true } } });
    expect(fields["shipping.street"]?.disabled).toBe(true);
    expect(server()).toEqual(testStore({ defaultValues: order(), plugins: [rules()] }, shippingRules()).server());
  });

  it("reads a field no rule names as shown, the same object on the server and the client", () => {
    const { store, errors } = testStore({ defaultValues: order(), plugins: [rules()] }, shippingRules());
    const meta = rules.meta(store.getSnapshot(["sameAsBilling"]));
    expect(meta).toEqual({ hidden: false });
    expect(store.getSnapshot(["sameAsBilling"])).toMatchObject({ disabled: false, readOnly: false });
    // A selector that returns it stays stable, so React doesn't render again.
    expect(rules.meta(store.getSnapshot(["sameAsBilling"]))).toBe(meta);
    expect(rules.meta(store.getServerSnapshot(["sameAsBilling"]))).toBe(meta);
    expect(errors).toEqual([]);
  });

  it("runs a fieldset's rules on the fieldset's value, at names below it", () => {
    const { store, errors } = testStore({ defaultValues: { orders: [order()] }, plugins: [rules()] });
    const [key] = store.root.at("orders").peek().keys;
    const item = store.root.at("orders").item(key!);
    attach(item, [shippingRules()]);
    expect(store.getSnapshot(["orders", key!, "shipping"]).disabled).toBe(true);
    item.at("sameAsBilling").setValue(false);
    expect(rules.meta(store.getSnapshot(["orders", key!, "shipping"])).hidden).toBe(false);
    expect(errors).toEqual([]);
  });
});
