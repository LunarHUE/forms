import { asyncScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { useForm } from "@lunarhue/forms-react";
import { forms, Probe, Status, SubmitButton } from "../parts.js";

const signUp = forms.define(scenario.definition);

export function AsyncPage() {
  const form = useForm(signUp);
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="username" label={scenario.labels.username} />
            <SubmitButton {...scenario.submit} />
            <Status />
          </form>
        )}
      </form.Form>
      <Probe store={form.store} sources={scenario.sources} />
    </>
  );
}
