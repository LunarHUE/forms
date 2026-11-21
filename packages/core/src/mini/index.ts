// The ./mini entry: a small store for small forms, with full's API shape.
// It never imports the main entry, so a form built on it doesn't ship it.
import type { FormError } from "../errors.js";
import type { FormsConfig as FullFormsConfig } from "../definition.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import type { Widened } from "../value.js";
import { createStore, type DefinitionOptions, type FormStore, type Parts, type Part } from "./store.js";

export { perField } from "../store/cells.js";
export { refuse } from "../store/refuse.js";
export { fieldValidators } from "./store.js";
export { observe, text, transform } from "./parts.js";
export type {
  AnyFormStore,
  DefinitionOptions,
  FieldPath,
  FieldSnapshot,
  FieldValidators,
  FieldValidatorSet,
  FormSnapshot,
  FormStore,
  LeafPath,
  NamedAnyFieldHandle,
  Part,
  PartContext,
  Parts,
  PartWrite,
  Path,
  Subscribe,
  SubmitContext,
  Validator,
  ValidatorContext,
  ValueAtName,
} from "./store.js";
export type { ErrorMap, FormError, Many } from "../errors.js";
export type { Submission } from "../snapshot.js";
export type { StandardSchemaV1 };

/** Settings for `createFormsCore`: the members of full's that mini keeps. */
export type FormsConfig = Pick<FullFormsConfig, "subscribe">;

/** A definition without a schema. `defaultValues` sets the value type, with its literals widened. */
export type PlainDefinition<V, E, R> = {
  readonly schema?: never;
  /** The starting value. */
  readonly defaultValues: V;
} & DefinitionOptions<NoInfer<Widened<V>>, NoInfer<Widened<V>>, E, R>;

/** A definition with any Standard Schema. Mini has no schema adapters, so `defaultValues` is required. */
export type SchemaDefinition<S extends StandardSchemaV1, E, R> = {
  /** The schema. It validates the whole value on blur and submit. */
  readonly schema: S;
  /** The starting value. */
  readonly defaultValues: StandardSchemaV1.InferInput<S>;
} & DefinitionOptions<StandardSchemaV1.InferInput<S>, StandardSchemaV1.InferOutput<S>, E, R>;

/** A definition's config: `SchemaDefinition` when `S` is a schema, `PlainDefinition` when it is `never`. */
export type Definition<V, S extends StandardSchemaV1, E, R> = [S] extends [never] ? PlainDefinition<V, E, R> : SchemaDefinition<S, E, R>;

/** The value type of a definition. */
export type DefinedValue<V, S extends StandardSchemaV1> = [S] extends [never] ? Widened<V> : StandardSchemaV1.InferInput<S>;

/** What `define` takes: a config, or a function of per-store options that returns one. */
export type DefineConfig<V, S extends StandardSchemaV1, O, E, R> = Definition<V, S, E, R> | ((options: O) => Definition<V, S, E, R>);

/** A form type that makes stores. `O` is what the definition's function form takes, and `void` for a plain config. */
export interface FormDefinition<V, E = FormError, I = undefined, R = unknown, O = void> {
  /** Makes a new store. `options` goes to the definition's function form. A plain config takes none. */
  createStore(options: O, instance?: { readonly id?: string }): FormStore<V, E, I, R>;
}

/** Defines forms, as full's `FormsCore` does, without plugins. */
export interface FormsCore<E = FormError> {
  /**
   * Defines a form from a config, or from a function of per-store options
   * that returns one: `define((options: O) => config)` runs once per
   * `createStore(options)`. Parts after the config attach at the root, or
   * at the name a part's `path` gives. Parts of full's, and plugins, are
   * type errors.
   */
  define<V = never, S extends StandardSchemaV1 = never, O = void, R = unknown>(
    config: DefineConfig<V, S, O, E, R>,
    ...parts: readonly Parts<NoInfer<DefinedValue<V, S>>>[]
  ): FormDefinition<DefinedValue<V, S>, E, undefined, R, O>;
}

/** Mini's entry point. Framework adapters wrap it in their own `createForms`. */
export const createFormsCore = (config?: FormsConfig): FormsCore => ({
  define: (definition: object, ...parts: readonly (Part<never, unknown> | readonly Part<never, unknown>[])[]) => ({
    createStore: (options?: unknown, instance?: { readonly id?: string }) =>
      // The definition's types were checked by `define`'s signature. The function form runs once per store.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      createStore({ ...((typeof definition === "function" ? definition(options) : definition) as { defaultValues: unknown }), id: instance?.id, parts: parts.flat(), subscribe: config?.subscribe }) as never,
  }),
});
