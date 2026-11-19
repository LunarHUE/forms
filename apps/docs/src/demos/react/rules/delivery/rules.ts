import { rules } from "@lunarhue/forms-react/plugins/rules";

export interface Order {
  pickup: boolean;
  gift: boolean;
  street: string;
  message: string;
}

// Each rule gets the whole value and returns flags for its field.
export const orderRules = rules<Order>({
  street: (value) => ({ disabled: value.pickup }),
  message: (value) => ({ hidden: !value.gift }),
});
