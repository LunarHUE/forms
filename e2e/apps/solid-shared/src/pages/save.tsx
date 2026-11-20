import { saveScenario as scenario } from "@lunarhue/forms-e2e/contract";
import { type AnyFormStore, createForm, createInvalidFields } from "@lunarhue/forms-solid";
import { For, Show } from "solid-js";
import { FormErrors, forms, Probe, Status, SubmitButton } from "../parts.js";

const account = forms.define(scenario.definition);
const { labels } = scenario;
const messagesOf = (errors: readonly { readonly message: string }[]) => errors.map((error) => error.message).join(" ");

/** Every field with errors. A field's entry is a button that focuses its input. The root has no input. */
function Summary(props: { readonly store: AnyFormStore }) {
  const invalid = createInvalidFields(props.store);
  return (
    <ul aria-label={labels.summary}>
      <For each={invalid()}>
        {(entry) => (
          <li>
            <Show when={entry.name !== ""} fallback={`form: ${messagesOf(entry.errors)}`}>
              <button type="button" onClick={() => document.getElementById(entry.field.id)?.focus()}>
                {`${entry.name}: ${messagesOf(entry.errors)}`}
              </button>
            </Show>
          </li>
        )}
      </For>
    </ul>
  );
}

export function SavePage() {
  const form = createForm(account);
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
