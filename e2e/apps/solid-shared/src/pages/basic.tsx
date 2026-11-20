import { basicScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { createForm } from "@lunarhue/forms-solid";
import { forms, Probe, Status, SubmitButton } from "../parts.js";

const signUp = forms.define(scenario.definition);
const { labels } = scenario;

export function BasicPage() {
  const form = createForm(signUp);
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="name" label={labels.name} />
            <form.TextField name="email" label={labels.email} />
            <form.Checkbox name="newsletter" label={labels.newsletter} />
            <form.TextField name="nickname" label={labels.nickname} />
            <form.Checkbox name="updates" label={labels.updates} />
            <SubmitButton {...scenario.submit} />
            <Status />
          </form>
        )}
      </form.Form>
      <Probe store={form.store} sources={scenario.sources} />
    </>
  );
}
