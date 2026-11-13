import { dirty } from "@lunarhue/forms-core/plugins/dirty";
import * as v from "valibot";
import { scenario } from "../scenario.js";

const Profile = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Enter your name.")),
  email: v.pipe(v.string(), v.email("Enter a valid email.")),
});

const labels = { name: "Name", email: "Email", reset: "Reset", resetEmail: "Reset email" };

/** Reset of the form and of one field, and `dirty()` driving a save button. */
export const dirtyScenario = {
  ...scenario("dirty", "Reset and dirty", {
    values: { [labels.name]: "Ada Lovelace", [labels.email]: "ada@example.com" },
  }),
  labels,
  errors: { email: "Enter a valid email." },
  /** The save button is enabled only while something differs from the start. */
  submit: { idle: "Save", busy: "Saving..." },
  definition: {
    schema: Profile,
    defaultValues: { name: "Ada Lovelace", email: "ada@example.com" },
    plugins: [dirty()] as const,
    onSubmit: (value: v.InferOutput<typeof Profile>) => `Saved ${value.name}.`,
  },
};
