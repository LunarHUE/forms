import { saveScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { type AnyFormStore, useForm, useInvalidFields } from "@lunarhue/forms-react";
import { FormErrors, forms, Probe, serverId, Status, SubmitButton } from "../parts.js";

const account = forms.define(scenario.definition);
const { labels } = scenario;
const messagesOf = (errors: readonly { readonly message: string }[]) => errors.map((error) => error.message).join(" ");

/** Every field with errors. A field's entry is a button that focuses its input. The root has no input. */
function Summary({ store }: { readonly store: AnyFormStore }) {
  const invalid = useInvalidFields(store);
  return (
    <ul aria-label={labels.summary}>
      {invalid.map((entry) => (
        <li key={entry.field.id}>
          {entry.name === "" ? (
            `form: ${messagesOf(entry.errors)}`
          ) : (
            <button type="button" onClick={() => document.getElementById(entry.field.id)?.focus()}>
              {`${entry.name}: ${messagesOf(entry.errors)}`}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SavePage() {
  const form = useForm(account, serverId(scenario.id));
  return (
    <>
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <Summary store={form.store} />
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
