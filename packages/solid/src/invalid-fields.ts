import type { InvalidField } from "@lunarhue/forms-core";
import { createSignal, isServer } from "#solid";
import { getOwner, onCleanup } from "solid-js";
import type { RuntimeStore } from "./form-runtime.js";

const none: readonly InvalidField<unknown>[] = [];

/** True when two lists name the same fields, with the same names and error lists. */
const sameFields = (a: readonly InvalidField<unknown>[], b: readonly InvalidField<unknown>[]): boolean =>
  a.length === b.length && a.every((entry, i) => entry.field === b[i]?.field && entry.name === b[i]?.name && entry.errors === b[i]?.errors);

/** See `createInvalidFields`. It follows the store's `subscribeInvalid`. */
export function createInvalidFieldList(form: RuntimeStore | { readonly store: RuntimeStore }): () => readonly InvalidField<unknown>[] {
  const store = "store" in form ? form.store : form;
  if (isServer) return () => none;
  if (getOwner() === null) return () => store.invalid();
  const [list, setList] = createSignal(store.invalid(), { ownedWrite: true, equals: sameFields });
  onCleanup(store.subscribeInvalid(() => setList(() => store.invalid())));
  return list;
}
