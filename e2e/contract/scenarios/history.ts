import type { FormSnapshot } from "@lunarhue/forms-core";
import { history } from "@lunarhue/forms-core/plugins";
import { scenario } from "../scenario.js";


const labels = { title: "Title", body: "Body", undo: "Undo", redo: "Redo" };

/** Undo and redo buttons, enabled from the plugin's form meta. */
export const historyScenario = {
  ...scenario("history", "History", { values: { [labels.title]: "", [labels.body]: "" } }),
  labels,
  submit: { idle: "Save", busy: "Saving..." },
  /** Whether there is a step to undo or redo. */
  steps: (snapshot: FormSnapshot<unknown>) => history.formMeta(snapshot),
  definition: {
    defaultValues: { title: "", body: "" },
    plugins: [history()] as const,
    onSubmit: (value: { title: string; body: string }) => `Saved ${value.title}.`,
  },
};
