import { inspectScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { radioProps, useField, useFieldRef, useForm } from "@lunarhue/forms-react";
import { forms, Probe, serverId } from "../parts.js";

const settings = forms.define(scenario.definition);
const { labels } = scenario;

export function InspectPage() {
  const form = useForm(settings, serverId(scenario.id));
  const rating = form.root.at("rating");
  const ratingRef = useFieldRef(rating);
  const value = useField(rating, (snapshot) => snapshot.value);
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.Field name="plan">
              {(field) => (
                <fieldset>
                  <legend>{labels.plan}</legend>
                  <label>
                    <input {...radioProps(field, "free")} />
                    {labels.free}
                  </label>
                  <label>
                    <input {...radioProps(field, "pro")} />
                    {labels.pro}
                  </label>
                </fieldset>
              )}
            </form.Field>
            <div className="field">
              <span ref={ratingRef} role="meter" aria-label={labels.rating} aria-valuenow={value} aria-valuemin={0} aria-valuemax={5}>
                {value}
              </span>
              <button type="button" onClick={() => rating.setValue(value + 1)}>
                {labels.raise}
              </button>
            </div>
          </form>
        )}
      </form.Form>
      <Probe store={form.store} />
    </>
  );
}
