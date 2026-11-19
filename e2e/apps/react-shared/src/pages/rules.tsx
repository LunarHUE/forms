import { rulesScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { useField, useForm } from "@lunarhue/forms-react";
import { rules } from "@lunarhue/forms-react/plugins";
import { forms, Probe, serverId, Status, SubmitButton } from "../parts.js";

const delivery = forms.define(scenario.definition, scenario.deliveryRules);
const { labels } = scenario;

export function RulesPage() {
  const form = useForm(delivery, serverId(scenario.id));
  const hidden = useField(form.root.at("message"), (snapshot) => rules.meta(snapshot).hidden);
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
            {hidden ? null : <form.TextField name="message" label={labels.message} />}
            <SubmitButton {...scenario.submit} />
            <Status />
          </form>
        )}
      </form.Form>
      <Probe store={form.store} />
    </>
  );
}
