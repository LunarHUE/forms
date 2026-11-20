import { inspectScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { createField, createForm, fieldRef, inputProps } from "@lunarhue/forms-solid";
import { forms, Probe } from "../parts.js";

const settings = forms.define(scenario.definition);
const { labels } = scenario;

export function InspectPage() {
  const form = createForm(settings);
  const rating = createField(form.root.at("rating"));
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
                    <input {...inputProps(field, { kind: "radio", value: "free" })} />
                    {labels.free}
                  </label>
                  <label>
                    <input {...inputProps(field, { kind: "radio", value: "pro" })} />
                    {labels.pro}
                  </label>
                </fieldset>
              )}
            </form.Field>
            <div class="field">
              <span
                ref={fieldRef(form.root.at("rating"))}
                role="meter"
                aria-label={labels.rating}
                aria-valuenow={rating.value}
                aria-valuemin={0}
                aria-valuemax={5}
              >
                {rating.value}
              </span>
              <button type="button" onClick={() => rating.setValue(rating.value + 1)}>
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
