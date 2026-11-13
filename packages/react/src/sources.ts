import type { FieldSnapshot, FormSnapshot } from "@lunarhue/forms-core";
import type { FormStateSource, HandleLike } from "./field.js";
import { cached, type Source } from "./select.js";

const fieldSources = new WeakMap<HandleLike, Source<FieldSnapshot<unknown, unknown>>>();
const formSources = new WeakMap<object, Source<FormSnapshot<unknown>>>();

/** The source for one field's snapshot, the same object for the life of the handle. */
export function fieldSource(handle: HandleLike): Source<FieldSnapshot<unknown, unknown>> {
  return cached(fieldSources, handle, () => {
    const { store, path } = handle;
    return {
      subscribe: (listener) => store.subscribe(path, listener),
      get: () => store.getSnapshot(path),
      server: () => store.getServerSnapshot(path),
    };
  });
}

/** The source for a store's form snapshot, the same object for the life of the store. */
export function formSource(store: FormStateSource<unknown, unknown>): Source<FormSnapshot<unknown>> {
  return cached(formSources, store, () => ({
    subscribe: (listener) => store.subscribeForm(listener),
    get: () => store.getFormSnapshot(),
    server: () => store.getServerFormSnapshot(),
  }));
}

/** The store behind a form object or a store. */
export const storeOf = <S extends object>(form: S | { readonly store: S }): S => ("store" in form ? form.store : form);
