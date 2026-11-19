import { createForms } from "@lunarhue/forms-react";
import { zod } from "@lunarhue/forms-schema/zod";
import { z } from "zod";
import { TextField } from "./TextField";

export const forms = createForms({
  plugins: [zod()],
  fields: { TextField },
});

export const Address = z.object({
  street: z.string().min(1, "Enter a street."),
  city: z.string().min(1, "Enter a city."),
});

export const Order = z.object({
  name: z.string().min(1, "Enter your name."),
  shipping: Address,
  billing: Address,
});
