import { bindScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { createForm } from "@lunarhue/forms-solid";
import { forms, Probe, Status, SubmitButton } from "../parts.js";

const profile = forms.define(scenario.definition);
const { labels } = scenario;

export function BindPage() {
  // One outside store per page. A Solid component runs once, so this does too.
  const store = scenario.createAppStore();
  const form = createForm(profile, { plugins: [scenario.bindTo(store)] });
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="name" label={labels.name} />
            <form.TextField name="email" label={labels.email} />
            <form.TextField name="city" label={labels.city} />
            <button type="button" onClick={() => scenario.changeOutside(store)}>
              {labels.change}
            </button>
            <button type="button" onClick={() => void scenario.refresh(form.store)}>
              {labels.refresh}
            </button>
            <SubmitButton {...scenario.submit} />
            <Status />
          </form>
        )}
      </form.Form>
      <Probe store={form.store} sources={scenario.sources(store)} />
    </>
  );
}
