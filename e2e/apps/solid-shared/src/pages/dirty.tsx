import { dirtyScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { createForm } from "@lunarhue/forms-solid";
import { forms, Probe, Status } from "../parts.js";

const profile = forms.define(scenario.definition);
const { labels } = scenario;

export function DirtyPage() {
  const form = createForm(profile);
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="name" label={labels.name} />
            <form.TextField name="email" label={labels.email} />
            <button type="submit" disabled={!form.state.dirty}>
              {scenario.submit.idle}
            </button>
            <button type="button" onClick={() => form.root.reset()}>
              {labels.reset}
            </button>
            <button type="button" onClick={() => form.root.at("email").reset()}>
              {labels.resetEmail}
            </button>
            <Status />
          </form>
        )}
      </form.Form>
      <Probe store={form.store} />
    </>
  );
}
