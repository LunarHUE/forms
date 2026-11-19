import { saveScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { useForm } from "@lunarhue/forms-react";
import { FormErrors, forms, Probe, serverId, Status, SubmitButton } from "../parts.js";

const account = forms.define(scenario.definition);
const { labels } = scenario;

export function SavePage() {
  const form = useForm(account, serverId(scenario.id));
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <FormErrors label={labels.formErrors} />
            <form.TextField name="name" label={labels.name} />
            <form.TextField name="email" label={labels.email} />
            <SubmitButton {...scenario.submit} />
            <Status />
          </form>
        )}
      </form.Form>
      <Probe store={form.store} sources={scenario.sources} />
    </>
  );
}
