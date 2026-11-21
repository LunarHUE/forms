import { createForms } from "@lunarhue/forms-react";
import { ruled, rules } from "@lunarhue/forms-react/plugins";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

export const forms = createForms({ plugins: [rules(), docsDevtools], fields: { TextField } });

export interface Address {
  street: string;
  city: string;
}

export interface Billing {
  sameAsShipping: boolean;
  address: Address;
}

// The rule travels with the fieldset. It gets the fieldset's value, not the form's.
export const BillingFieldset = forms.fieldset<Billing, typeof rules>(
  ruled({ address: (billing) => ({ hidden: billing.sameAsShipping }) }),
);
