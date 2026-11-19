import { maskScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { createForm } from "@lunarhue/forms-solid";
import { forms, Probe, Status, SubmitButton } from "../parts.js";

const contact = forms.define(scenario.definition);

export function MaskPage() {
  const form = createForm(contact);
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.PhoneField name="phone" label={scenario.labels.phone} />
            <SubmitButton {...scenario.submit} />
            <Status />
          </form>
        )}
      </form.Form>
      <Probe store={form.store} />
    </>
  );
}
