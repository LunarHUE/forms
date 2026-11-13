import type {
  DefinedValue,
  Definition,
  FormDefinition,
  FormError,
  FormsConfig,
  FormStore,
  SchemaAdapter,
  StandardSchemaV1,
  StoreInstance,
} from "@lunarhue/forms-core";
import { notImplemented } from "./not-implemented.js";

/**
 * A form definition from `createForms`. It is core's definition, so
 * `createStore` still works outside components, plus `createForm` for use
 * inside one.
 */
export interface SolidFormDefinition<V, E = FormError, I = undefined, R = unknown, O = void>
  extends FormDefinition<V, E, I, R, O> {
  /**
   * Makes a new store for a component. Call it in the component body. It
   * does what `createStore` does, except that the store id defaults to
   * `createUniqueId()`, which matches between server and client. Pass the
   * store to `FormContext` to reach it from nested components.
   */
  createForm(options: O, instance?: StoreInstance): FormStore<V, E, I, R>;
}

/**
 * Defines forms for Solid. `define` takes exactly what core's `define`
 * takes, with the same inference: `V` from the schema or `defaultValues`,
 * `E` from `mapError`, `I` from the annotation on `onSubmit`'s
 * `ctx.intent`, `R` from what `onSubmit` returns.
 */
export interface SolidFormsCore<A extends readonly SchemaAdapter<never>[] = [], E = FormError> {
  /** Defines a form. See core's `FormsCore.define`. */
  define<V = never, S extends StandardSchemaV1 = never, O = void, I = undefined, R = unknown>(
    config: Definition<V, S, A, E, I, R> | ((options: O) => Definition<V, S, A, E, I, R>),
  ): SolidFormDefinition<DefinedValue<V, S, A>, E, I, R, O>;
}

/**
 * The adapter's entry point. It wraps `createFormsCore` and takes the same
 * config. Call it once at module scope: it holds settings, never state.
 */
export type CreateForms = <const A extends readonly SchemaAdapter<never>[] = [], E = FormError>(
  config?: FormsConfig<A, E>,
) => SolidFormsCore<A, E>;

/** See `CreateForms`. Not implemented yet: it throws. */
export const createForms: CreateForms = notImplemented("createForms");
