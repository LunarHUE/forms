import { persistScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { createForm } from "@lunarhue/forms-solid";
import { forms, Probe, Status, SubmitButton } from "../parts.js";

const feedback = forms.define(scenario.definition);
const { labels } = scenario;

export function PersistPage() {
  const form = createForm(feedback);
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="subject" label={labels.subject} />
            <form.TextField name="message" label={labels.message} />
            <button type="button" onClick={() => form.root.reset()}>
              {labels.discard}
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
