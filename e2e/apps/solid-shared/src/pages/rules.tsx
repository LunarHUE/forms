import { rulesScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { createField, createForm } from "@lunarhue/forms-solid";
import { Show } from "solid-js";
import { rules } from "@lunarhue/forms-solid/plugins";
import { forms, Probe, Status, SubmitButton } from "../parts.js";

const delivery = forms.define(scenario.definition, scenario.deliveryRules);
const { labels } = scenario;

export function RulesPage() {
  const form = createForm(delivery);
  const message = createField(form.root.at("message"));
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="reference" label={labels.reference} />
            <form.Checkbox name="insured" label={labels.insured} />
            <form.Checkbox name="pickup" label={labels.pickup} />
            <fieldset>
              <legend>{labels.address}</legend>
              <form.TextField name="address.street" label={labels.street} />
              <form.TextField name="address.city" label={labels.city} />
            </fieldset>
            <form.Checkbox name="gift" label={labels.gift} />
            <Show when={!rules.meta(message).hidden}>
              <form.TextField name="message" label={labels.message} />
            </Show>
            <SubmitButton {...scenario.submit} />
            <Status />
          </form>
        )}
      </form.Form>
      <Probe store={form.store} />
    </>
  );
}
