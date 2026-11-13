import { historyScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { useForm, useFormState } from "@lunarhue/forms-react";
import { forms, Probe, Status, SubmitButton } from "../parts.js";

const note = forms.define(scenario.definition);
const { labels } = scenario;

export function HistoryPage() {
  const form = useForm(note);
  const canUndo = useFormState(form, (state) => scenario.steps(state).canUndo);
  const canRedo = useFormState(form, (state) => scenario.steps(state).canRedo);
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="title" label={labels.title} />
            <form.TextField name="body" label={labels.body} />
            <button type="button" disabled={!canUndo} onClick={() => form.plugins.history.undo()}>
              {labels.undo}
            </button>
            <button type="button" disabled={!canRedo} onClick={() => form.plugins.history.redo()}>
              {labels.redo}
            </button>
            <SubmitButton {...scenario.submit} />
            <Status />
          </form>
        )}
      </form.Form>
      <Probe store={form.store} />
    </>
  );
}
