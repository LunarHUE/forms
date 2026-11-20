// The back office's data, checked by Zod. Both builds validate with these
// schemas, so they show the same messages.
import { z } from "zod";

export const countries = ["US", "GB", "IE", "DE"] as const;

export const Address = z.object({
  street: z.string().min(1, "Enter a street."),
  city: z.string().min(1, "Enter a city."),
  // Only US addresses show it, and it may stay empty.
  region: z.string(),
  postcode: z.string().min(1, "Enter a postcode."),
  country: z.enum(countries, "Pick a country."),
});
export type Address = z.infer<typeof Address>;

const phone = z.string().regex(/^\d{10}$/, "Enter ten digits.");

export const Customer = z
  .object({
    name: z.string().min(1, "Enter a name."),
    email: z.email("Enter a valid email."),
    phone,
    billing: Address,
    sameAsBilling: z.boolean(),
    // Checked below, only when it is used.
    shipping: Address.extend({ street: z.string(), city: z.string(), postcode: z.string() }),
  })
  .superRefine(
    (customer, ctx) => {
      if (customer.sameAsBilling) return;
      for (const issue of Address.safeParse(customer.shipping).error?.issues ?? []) {
        ctx.addIssue({ code: "custom", message: issue.message, path: ["shipping", ...issue.path] });
      }
    },
    // Runs even when other fields have issues, so every error shows at once.
    { when: () => true },
  );
export type Customer = z.infer<typeof Customer>;

export const Line = z.object({
  sku: z.string().min(1, "Enter a SKU."),
  quantity: z.string().regex(/^[1-9]\d*$/, "Enter a quantity."),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a price."),
});
export type Line = z.infer<typeof Line>;

export const Order = z.object({
  reference: z.string().min(1, "Enter a reference."),
  lines: z.array(Line).min(1, "Add at least one line."),
  gift: z.boolean(),
  giftMessage: z.string().max(140, "Keep it under 140 characters."),
});
export type Order = z.infer<typeof Order>;

export const Company = z.object({
  name: z.string().min(1, "Enter the company name."),
  phone,
  taxId: z.string().regex(/^\d{9}$/, "Enter nine digits."),
  address: Address,
});
export type Company = z.infer<typeof Company>;

export const roles = ["admin", "member", "viewer"] as const;

export const Invite = z.object({
  email: z.email("Enter a valid email."),
  role: z.enum(roles),
  message: z.string().max(280, "Keep it under 280 characters."),
});
export type Invite = z.infer<typeof Invite>;
