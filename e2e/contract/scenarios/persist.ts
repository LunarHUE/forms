import { persist } from "@lunarhue/forms-core/plugins/persist";
import { scenario } from "../scenario.js";

/** The localStorage key the draft is saved under. */
const storageKey = "e2e-feedback-draft";

const labels = { subject: "Subject", message: "Message", discard: "Discard draft" };

/** A draft kept in localStorage that survives a reload. The server renders the defaults. */
export const persistScenario = {
  ...scenario("persist", "Persist", { values: { [labels.subject]: "", [labels.message]: "" } }),
  labels,
  storageKey,
  submit: { idle: "Send", busy: "Sending..." },
  definition: {
    defaultValues: { subject: "", message: "" },
    plugins: [persist(storageKey)] as const,
    onSubmit: (value: { subject: string; message: string }) => `Sent ${value.subject}.`,
  },
};
