import type { FormSnapshot } from "@lunarhue/forms-core";
import { history } from "@lunarhue/forms-core/plugins/history";
import { scenario } from "../scenario.js";

const undoHistory = history();

const labels = { title: "Title", body: "Body", undo: "Undo", redo: "Redo" };

/** Undo and redo buttons, enabled from the plugin's form meta. */
export const historyScenario = {
  ...scenario("history", "History", { values: { [labels.title]: "", [labels.body]: "" } }),
  labels,
  submit: { idle: "Save", busy: "Saving..." },
  /** Whether there is a step to undo or redo. The meta is undefined until the first step. */
  steps: (snapshot: FormSnapshot<unknown>) => {
    const meta = undoHistory.formMeta(snapshot);
    return { canUndo: meta?.canUndo ?? false, canRedo: meta?.canRedo ?? false };
  },
  definition: {
    defaultValues: { title: "", body: "" },
    plugins: [undoHistory] as const,
    onSubmit: (value: { title: string; body: string }) => `Saved ${value.title}.`,
  },
};
