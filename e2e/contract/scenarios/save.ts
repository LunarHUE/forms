import type { ErrorMap, FormError } from "@lunarhue/forms-core";
import * as v from "valibot";
import { fakeServer } from "../fake-server.js";
import { scenario } from "../scenario.js";

const Account = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Enter your name.")),
  email: v.pipe(v.string(), v.email("Enter a valid email.")),
});

const labels = { name: "Name", email: "Email", formErrors: "Form errors", summary: "Error summary" };

/** The email the fake server refuses to save. */
const takenEmail = "taken@example.com";

/** A name the fake server refuses with an error under a field name the form doesn't have. */
const renamedName = "Grace Hopper";

const messages = {
  email: "This email already has an account.",
  form: "The server refused the save. Fix the errors and try again.",
  refused: "The server refused the save.",
  renamed: "Use your full legal name.",
};

/** What `onSubmit` uses of its context. */
interface SaveContext {
  readonly store: { setErrors(errors: ErrorMap<FormError>): void };
}

/** A save the server can refuse: its errors land on a field and on the form, and the next save works. */
export const saveScenario = {
  ...scenario("save", "Refused save", {
    values: { [labels.name]: "Ada Lovelace", [labels.email]: "ada@example.com" },
  }),
  labels,
  takenEmail,
  renamedName,
  messages,
  submit: { idle: "Save", busy: "Saving..." },
  sources: { server: fakeServer },
  definition: {
    schema: Account,
    defaultValues: { name: "Ada Lovelace", email: "ada@example.com" },
    onSubmit: async (value: v.InferOutput<typeof Account>, { store }: SaveContext) => {
      const count = await fakeServer.save(value);
      if (value.email === takenEmail) {
        store.setErrors({ form: { message: messages.form }, fields: { email: { message: messages.email } } });
        return messages.refused;
      }
      if (value.name === renamedName) {
        // The server still calls the name field by an old name, which no field has.
        store.setErrors({ fields: { fullName: { message: messages.renamed } } });
        return messages.refused;
      }
      store.setErrors({});
      return `Saved ${value.name} (save ${count}).`;
    },
  },
};
