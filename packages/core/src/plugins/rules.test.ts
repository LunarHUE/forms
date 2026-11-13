import { describe, expect, it } from "vitest";
import { rules } from "./rules.js";
import { testStore } from "./testing.js";

interface Order {
  sameAsBilling: boolean;
  shipping: { street: string };
}

const order = (): Order => ({ sameAsBilling: true, shipping: { street: "" } });
const shippingRules = () => rules<Order>({ shipping: (value) => ({ disabled: value.sameAsBilling, hidden: value.sameAsBilling }) });

describe("rules", () => {
  it("derives disabled and hidden from the value before listeners run", () => {
    const ruleSet = shippingRules();
    const { store, errors } = testStore({ defaultValues: order(), plugins: [ruleSet] });
    const seen: unknown[] = [];
    store.subscribe(["shipping"], () => {
      const snapshot = store.getSnapshot(["shipping"]);
      seen.push({ disabled: snapshot.disabled, hidden: ruleSet.meta(snapshot)?.hidden });
    });
    store.root.at("sameAsBilling").setValue(false);
    expect(seen).toEqual([{ disabled: false, hidden: false }]);
    expect(errors).toEqual([]);
  });

  it("puts what it sets at setup in the server snapshots, the same on every store", () => {
    const ruleSet = shippingRules();
    const { server } = testStore({ defaultValues: order(), plugins: [ruleSet] });
    const { fields } = server();
    expect(fields["shipping"]).toMatchObject({ disabled: true, meta: { rules: { hidden: true } } });
    expect(fields["shipping.street"]?.disabled).toBe(true);
    expect(server()).toEqual(testStore({ defaultValues: order(), plugins: [shippingRules()] }).server());
  });
});
