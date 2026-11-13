import type { FormSnapshot, FormStore } from "@lunarhue/forms-core";
import { isServer } from "@solidjs/web";
import { getOwner, isDisposed, runWithOwner, type Element as SolidElement } from "solid-js";
import { provideForm, type FormChildren, type RuntimeForm } from "./context.js";
import { focusInvalid, type RuntimeFocus } from "./focus.js";
import { defineGetters, formReader } from "./reader.js";
import { registerFormElement } from "./refs.js";
import type { RuntimeScope } from "./scope-runtime.js";

/** A store with its types erased, as the runtime uses it. */
export type RuntimeStore = FormStore<unknown, unknown, unknown>;

/**
 * The form snapshot as getters. The signal is made the first time a getter
 * is read inside an owner, and belongs to `owner`, the owner `createForm`
 * ran in. Reads before that, outside any owner, or with no form owner read
 * the store directly.
 */
function createFormState(store: RuntimeStore): object {
  const owner = getOwner();
  let read: (() => FormSnapshot<unknown>) | undefined;
  const current = () => {
    if (read) return read();
    if (owner === null || isDisposed(owner) || getOwner() === null) {
      return isServer ? store.getServerFormSnapshot() : store.getFormSnapshot();
    }
    read = runWithOwner(owner, () => formReader(store));
    return read();
  };
  const state = {};
  // The server snapshot has every member the form snapshot has, except `meta`, which `defineGetters` adds.
  defineGetters(state, Object.keys(store.getServerFormSnapshot()), current);
  return state;
}

/** What `buildForm` takes. */
export interface FormParts {
  readonly store: RuntimeStore;
  /** The scope at the store's root. Its members become the form's. */
  readonly scope: RuntimeScope;
  readonly focusOnInvalid: RuntimeFocus;
}

/** Builds the form object. Call it in the owner the form's subscriptions belong to. */
export function buildForm(parts: FormParts): RuntimeForm {
  const { store, scope, focusOnInvalid } = parts;

  const submit = async (...args: [intent?: unknown]) => {
    const submission = await store.submit(...args);
    if (submission.status === "invalid") focusInvalid(store, focusOnInvalid);
    return submission;
  };
  const handleSubmit = async (event?: { preventDefault(): void }) => {
    await store.handleSubmit(event);
    if (store.peek().submission.status === "invalid") focusInvalid(store, focusOnInvalid);
  };
  const formProps = {
    id: store.id,
    novalidate: true,
    tabindex: -1,
    onSubmit: (event: Event) => {
      void handleSubmit(event);
    },
    ref: (element: HTMLFormElement) => {
      registerFormElement(store, element);
    },
  } as const;
  const form: Record<string, unknown> = {
    ...scope,
    store,
    id: store.id,
    state: createFormState(store),
    formProps,
    submit,
    handleSubmit,
  };
  form.Form = (props: { readonly children: FormChildren }): SolidElement => provideForm(form, props);
  return form;
}
