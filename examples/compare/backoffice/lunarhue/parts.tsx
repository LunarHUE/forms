// The pieces every back office form shares. Each finds its form with
// `useFormContext(forms)`, so they need no props to reach it.
import { type HandleOf, useField, useFormContext, useFormState, useInvalidFields } from "@lunarhue/forms-react";
import { history, rules } from "@lunarhue/forms-react/plugins";
import { countries } from "../schemas.ts";
import { ErrorSummaryView, SaveBarView } from "../ui.tsx";
import { AddressFieldset, forms } from "./forms.ts";

/** The change count, undo, refresh, discard and save. `load` fetches the server's copy for Refresh. */
export function SaveBar({ load }: { readonly load: () => Promise<unknown> }) {
  const form = useFormContext(forms);
  const canUndo = useFormState(form, (state) => history.formMeta(state).canUndo);
  const submitting = useFormState(form, (state) => state.submitting);
  // `changes()` is a read, not a subscription, so it runs whenever the root
  // field changes.
  const count = useField(form.root, () => form.store.changes().length);

  // Fields the user hasn't changed take the server's copy. Changed ones keep
  // their text and stay dirty against the new baseline.
  const refresh = async () => {
    const fresh = await load();
    form.plugins.rebase(form.root, fresh, (leaf) => (Object.is(leaf.value, leaf.baseline) ? "take" : "keep"));
  };

  return (
    <SaveBarView
      count={count}
      canUndo={canUndo}
      submitting={submitting}
      onUndo={() => form.plugins.history.undo()}
      onRefresh={() => void refresh()}
      onDiscard={() => form.root.reset()}
    />
  );
}

/** Every field with errors, once the user has tried to save. */
export function ErrorSummary() {
  const form = useFormContext(forms);
  const tried = useFormState(form, (state) => state.submitCount > 0);
  const invalid = useInvalidFields(form);
  const problems = invalid.map((entry) => ({ id: entry.field.id, name: entry.name, messages: entry.errors.map((error) => error.message) }));
  return <ErrorSummaryView problems={tried ? problems : []} />;
}

/** An address anywhere in any form. A rule on the handle above it can hide it whole. */
export function AddressFields({ field, legend }: { readonly field: HandleOf<typeof AddressFieldset>; readonly legend: string }) {
  const hidden = useField(field, (snapshot) => rules.meta(snapshot).hidden);
  const scope = AddressFieldset.scope(field);
  if (hidden) return null;
  return (
    <fieldset>
      <legend>{legend}</legend>
      <scope.TextField name="street" label="Street" />
      <scope.TextField name="city" label="City" />
      <scope.TextField name="region" label="State" />
      <scope.TextField name="postcode" label="Postcode" />
      <scope.Select name="country" label="Country" options={countries} />
    </fieldset>
  );
}
