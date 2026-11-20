import { createForms } from "@lunarhue/forms-solid";
import { z } from "zod";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

// No plugins: the schemas below validate through Standard Schema.
export const forms = createForms({ plugins: [docsDevtools], fields: { TextField } });

export const Address = z.object({
  street: z.string().min(1, "Enter a street."),
  city: z.string().min(1, "Enter a city."),
});

export const Order = z.object({
  name: z.string().min(1, "Enter your name."),
  shipping: Address,
  billing: Address,
});
