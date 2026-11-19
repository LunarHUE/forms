import { basicScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { useForm } from "@lunarhue/forms-react";
import { forms, Probe, serverId, Status, SubmitButton } from "../parts.js";

const signUp = forms.define(scenario.definition);
const { labels } = scenario;

export function BasicPage() {
  const form = useForm(signUp, serverId(scenario.id));
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="name" label={labels.name} />
            <form.TextField name="email" label={labels.email} />
            <form.Checkbox name="newsletter" label={labels.newsletter} />
            <SubmitButton {...scenario.submit} />
            <Status />
          </form>
        )}
      </form.Form>
      <Probe store={form.store} sources={scenario.sources} />
    </>
  );
}
