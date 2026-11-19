import { rules } from "@lunarhue/forms-core/plugins";
import { scenario } from "../scenario.js";

export interface Delivery {
  reference: string;
  insured: boolean;
  pickup: boolean;
  address: { street: string; city: string };
  gift: boolean;
  message: string;
}

/** Picking up disables the whole address. The message shows only for a gift. */
const deliveryRules = rules<Delivery>({
  address: (value) => ({ disabled: value.pickup }),
  message: (value) => ({ hidden: !value.gift }),
});

const labels = {
  reference: "Order reference",
  insured: "Insured",
  pickup: "I'll pick it up",
  address: "Delivery address",
  street: "Street",
  city: "City",
  gift: "It's a gift",
  message: "Gift message",
};

/**
 * A fieldset disabled and a field hidden from checkboxes, and two read-only
 * fields, all already so in the server HTML.
 */
export const rulesScenario = {
  ...scenario("rules", "Rules", {
    values: { [labels.reference]: "ORD-1", [labels.street]: "12 St James's Square", [labels.city]: "London" },
    checked: [labels.insured, labels.pickup],
    readOnly: [labels.reference, labels.insured],
    disabled: [labels.street, labels.city],
    absent: [labels.message],
  }),
  labels,
  submit: { idle: "Order", busy: "Ordering..." },
  deliveryRules,
  definition: {
    // The loaded order is a pickup, so the address starts disabled.
    defaultValues: {
      reference: "ORD-1",
      insured: true,
      pickup: true,
      address: { street: "12 St James's Square", city: "London" },
      gift: false,
      message: "",
    },
    readOnly: { reference: true, insured: true },
    plugins: [deliveryRules] as const,
    onSubmit: (value: Delivery) => (value.pickup ? "Ordered for pickup." : `Ordered to ${value.address.city}.`),
  },
};
