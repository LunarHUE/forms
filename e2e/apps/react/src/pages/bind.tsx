import { bindScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { useForm } from "@lunarhue/forms-react";
import { useState } from "react";
import { forms, Probe, Status, SubmitButton } from "../parts.js";

const profile = forms.define(scenario.definition);
const { labels } = scenario;

export function BindPage() {
  // One outside store per page, made once.
  const [store] = useState(scenario.createAppStore);
  const [sources] = useState(() => scenario.sources(store));
  const form = useForm(profile, { plugins: [scenario.bindTo(store)] });
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
      <Probe store={form.store} sources={sources} />
    </>
  );
}
