import { dirtyScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { useForm } from "@lunarhue/forms-react";
import { forms, Probe, serverId, Status } from "../parts.js";

const profile = forms.define(scenario.definition);
const { labels } = scenario;

export function DirtyPage() {
  const form = useForm(profile, serverId(scenario.id));
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="name" label={labels.name} />
            <form.TextField name="email" label={labels.email} />
            <form.State select={(state) => state.dirty}>
              {(changed) => (
                <button type="submit" disabled={!changed}>
                  {scenario.submit.idle}
                </button>
              )}
            </form.State>
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
