import { baselineOnSubmit, dirty } from "@lunarhue/forms-core/plugins";
import * as v from "valibot";
import { fakeServer } from "../fake-server.js";
import { scenario } from "../scenario.js";

const Profile = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Enter your name.")),
  email: v.pipe(v.string(), v.email("Enter a valid email.")),
});

const labels = { name: "Name", email: "Email", reset: "Reset", resetEmail: "Reset email" };

/** Reset of the form and of one field, `dirty()` driving a save button, and `baselineOnSubmit()` making a save clean. */
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
    plugins: [dirty(), baselineOnSubmit()] as const,
    onSubmit: async (value: v.InferOutput<typeof Profile>) => {
      await fakeServer.save(value);
      return `Saved ${value.name}.`;
    },
  },
};
