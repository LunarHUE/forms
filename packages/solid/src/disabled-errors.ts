import type { DisabledInvalid } from "@lunarhue/forms-core";
import { createSignal, isServer } from "#solid";
import { getOwner, onCleanup } from "solid-js";
import type { RuntimeStore } from "./form-runtime.js";

const none: readonly DisabledInvalid<unknown>[] = [];

/** True when two lists hold the same fields with the same error lists. */
function sameList(a: readonly DisabledInvalid<unknown>[], b: readonly DisabledInvalid<unknown>[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((entry, index) => entry.field === b[index]?.field && entry.errors === b[index]?.errors);
}

/** The list as of now: the disabled invalid fields while the latest submit is invalid, else nothing. */
function currentList(store: RuntimeStore): readonly DisabledInvalid<unknown>[] {
  return store.peek().submission.status === "invalid" ? store.disabledInvalid() : none;
}

/**
 * See `createDisabledErrors`. It follows the form snapshot, and each listed
 * field's snapshot, so a listed field that is fixed or enabled drops off.
 */
export function createDisabledErrorList(form: RuntimeStore | { readonly store: RuntimeStore }): () => readonly DisabledInvalid<unknown>[] {
  const store = "store" in form ? form.store : form;
  if (isServer) return () => none;
  if (getOwner() === null) return () => currentList(store);

  const initial = currentList(store);
  const [list, setList] = createSignal(initial, { ownedWrite: true, equals: sameList });
  let fieldListeners: (() => void)[] = [];
  const unsubscribeFields = () => {
    for (const unsubscribe of fieldListeners) unsubscribe();
    fieldListeners = [];
  };
  const listen = (entries: readonly DisabledInvalid<unknown>[]) => {
    unsubscribeFields();
    fieldListeners = entries.map((entry) => store.subscribe(entry.field.path, update));
  };
  function update() {
    const next = currentList(store);
    listen(next);
    setList(() => next);
  }
  listen(initial);
  onCleanup(store.subscribeForm(update));
  onCleanup(unsubscribeFields);
  return list;
}
