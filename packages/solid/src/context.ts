import type { FormDefinition, FormStore } from "@lunarhue/forms-core";
import { type Context, createContext } from "solid-js";
import { notImplemented } from "./not-implemented.js";

/** A store of any form, as the context holds it. */
// `any` lets a store of every value, error, intent and result type fit.
// oxlint-disable-next-line typescript/no-explicit-any
export type ContextStore = FormStore<any, any, any, any>;

/**
 * Carries a store to nested components. In Solid 2 the context is its own
 * provider: `<FormContext value={form}>`. Handles carry their store, so
 * `createField`, `Field`, `Items` and the input props work without it.
 */
export const FormContext: Context<ContextStore> = createContext<ContextStore>();

/**
 * Returns the store from the nearest `FormContext`, and throws Solid's
 * `ContextNotFoundError` when there is none. Pass the form's definition to
 * get the store typed by it. The definition is only read for its type.
 */
export interface UseFormStore {
  <V, E, I, R, O>(definition: FormDefinition<V, E, I, R, O>): FormStore<V, E, I, R>;
  (): ContextStore;
}

/** See `UseFormStore`. Not implemented yet: it throws. */
export const useFormStore: UseFormStore = notImplemented("useFormStore");
