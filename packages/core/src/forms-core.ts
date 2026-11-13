import type {
  CreateFormsCore,
  DefinedValue,
  Definition,
  FormDefinition,
  FormsConfig,
  FormsCore,
  StoreInstance,
} from "./definition.js";
import type { FormError } from "./errors.js";
import type { SchemaAdapter } from "./schema-adapter.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import type { FormStore } from "./store.js";
import { createFormStore, type FormStoreOptions } from "./store/form-store.js";
import { isPlainObject } from "./store/tree.js";

/** The store options with every type parameter erased, as the runtime builds them. */
type AnyStoreOptions = FormStoreOptions<unknown, unknown, unknown, unknown, unknown>;

/** A definition's config as the runtime reads it. */
interface AnyConfig
  extends Pick<AnyStoreOptions, "schema" | "validate" | "show" | "equals" | "disabled" | "readOnly" | "onSubmit" | "plugins"> {
  readonly defaultValues?: unknown;
}

/** The store id when `createStore` gets none. */
const defaultId = "form";

/** `over` on top of `base`, object by object. An undefined key keeps the base's value. */
function mergeDefaults(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(over)) return over;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) out[key] = mergeDefaults(base[key], value);
  return out;
}

/** The value a store starts from: the adapter's defaults with `defaultValues` over them, or `defaultValues` alone. */
function initialValue(definition: AnyConfig, adapter: SchemaAdapter | undefined): unknown {
  const { schema, defaultValues } = definition;
  if (schema === undefined) return defaultValues;
  if (adapter) return mergeDefaults(adapter.defaultValue(schema), defaultValues);
  if (defaultValues === undefined)
    throw new Error(`No schema adapter for vendor "${schema["~standard"].vendor}", so the definition needs defaultValues.`);
  return defaultValues;
}

/**
 * Core's entry point. It returns `define` and does nothing else: no adapter,
 * validator or store runs until `createStore`. A store's id is
 * `instance.id`, or `"form"` without one, never a counter or a random value,
 * so server and client agree. Two stores on one page need distinct ids for
 * their DOM ids to be unique.
 */
export const createFormsCore: CreateFormsCore = <const A extends readonly SchemaAdapter<never>[] = [], E = FormError>(
  config: FormsConfig<A, E> = {},
): FormsCore<A, E> => {
  // An adapter only ever gets schemas whose vendor it named, which are the schemas it supports.
  const adapters: readonly SchemaAdapter[] = config.schemas ?? [];
  // The first adapter with a vendor wins, so a later one with the same vendor is never asked.
  const adapterFor = (schema: StandardSchemaV1) => adapters.find((adapter) => adapter.vendor === schema["~standard"].vendor);

  const storeOptions = (definition: AnyConfig, instance: StoreInstance | undefined): AnyStoreOptions => {
    const { schema } = definition;
    const adapter = schema === undefined ? undefined : adapterFor(schema);
    // The definition's own keys pass through: schema, validate, equals, disabled, readOnly, onSubmit and plugins.
    // Every store option treats undefined as not given.
    return {
      ...definition,
      id: instance?.id ?? defaultId,
      initial: initialValue(definition, adapter),
      itemValue: adapter && schema ? (path) => adapter.itemValue(schema, path) : undefined,
      timing: config.validate,
      // The error type is erased here. The contract ties `mapError`'s return type to the store's `E`.
      mapError: config.mapError,
      show: definition.show ?? config.show,
      sharedEquals: config.equals,
      // The shared plugins run first, then the definition's own.
      plugins: config.plugins ? [...config.plugins, ...(definition.plugins ?? [])] : definition.plugins,
      onPluginError: config.onPluginError,
    };
  };

  const define = <V = never, S extends StandardSchemaV1 = never, O = void, I = undefined, R = unknown>(
    definition: Definition<V, S, A, E, I, R> | ((options: O) => Definition<V, S, A, E, I, R>),
  ): FormDefinition<DefinedValue<V, S, A>, E, I, R, O> => {
    // `Definition` is a conditional type the runtime can't narrow. Every branch of it is an `AnyConfig`.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const source = definition as unknown as AnyConfig | ((options: O) => AnyConfig);
    return {
      createStore(options, instance) {
        // The function form runs once per store, and a plain config is read once per store.
        const resolved = typeof source === "function" ? source(options) : source;
        // The options were built from a config of these types, which the store keeps.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        return createFormStore(storeOptions(resolved, instance)) as unknown as FormStore<DefinedValue<V, S, A>, E, I, R>;
      },
    };
  };

  return { define };
};
