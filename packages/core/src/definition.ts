import type { FormError, MapError, Show } from "./errors.js";
import type { Path } from "./path.js";
import type { HasSchemaPlugin, Needs, NamedParts, Part, PluginApis, PluginErrorHandler, PluginNames, Plugins, PluginsFor, RequiresMet } from "./plugin.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import type { FormStore } from "./store.js";
import type { Subscribe } from "./store/cells.js";
import type { FieldValidatorSet, FormValidatorSet, ValidateTiming } from "./validator.js";
import type { ChildValue, DeepPartial, DeepReadonly, Draft, IsUnknown, ItemOf, KeysOf, PlatformAbortSignal, ShapeOf, Widened } from "./value.js";

/**
 * Compares two values for dirty tracking. Return true when they count as
 * equal. Call `next` to fall back to the comparison after this one, which in
 * the end is core's default: `Object.is` on primitives, dates by timestamp,
 * plain objects key by key with a missing key equal to undefined, arrays in
 * order, and everything else by reference. Two values that are the same
 * reference count as equal without `equals` being asked.
 */
export type Equals = (
  a: unknown,
  b: unknown,
  ctx: { readonly path: Path },
  next: (a: unknown, b: unknown) => boolean,
) => boolean;

/**
 * A disabled or read-only declaration shaped like the value: `true` or
 * `false` for a whole subtree, a record of child entries at an object, or a
 * one-element tuple at an array whose entry applies to every item.
 */
export type Flags<V> = boolean | NestedFlags<V>;

/** The nested forms of `Flags`. */
export type NestedFlags<V> =
  IsUnknown<V> extends true
    ? never
    : ShapeOf<V> extends "array"
      ? readonly [Flags<ItemOf<V>>]
      : ShapeOf<V> extends "object"
        ? { readonly [K in KeysOf<V>]?: Flags<ChildValue<V, K>> }
        : never;

/** Settings shared by every form made from one `createFormsCore` call. */
export interface FormsConfig<P extends Plugins = [], E = FormError> {
  /**
   * The plugins every form gets, in one list:
   * - schema plugins such as `valibot()` from `@lunarhue/forms-schema/valibot`,
   *   which give their library's schemas default values;
   * - first-class plugins such as `history()` from
   *   `@lunarhue/forms-core/plugins`, and hook plugins made with
   *   `definePlugin` from the same entry.
   *
   * The list's type decides what `define` accepts: a schema a schema plugin
   * accepts makes `defaultValues` optional, `equals` needs `dirty()`, and
   * each hook plugin's API shows up on the store's `plugins`. Hook plugins run in this
   * order, except that a plugin runs after the ones it `requires`, and before a
   * definition's own plugins. A plugin that another one `requires` must be
   * in this list too.
   */
  readonly plugins?: P & RequiresMet<P, PluginNames<P>>;
  /**
   * Turns schema issues and thrown validator errors into the error type. Its
   * return type sets `E` for every form. Without it `E` is `FormError`.
   */
  readonly mapError?: MapError<E>;
  /** When validators first run. Defaults to `"blur"`. */
  readonly validate?: ValidateTiming;
  /** When errors show. Defaults to `"touched-or-submitted"`. */
  readonly show?: Show;
  /**
   * The dirty comparison. A form's own `equals` runs first and reaches this
   * one through `next`. It needs `dirty()` in `plugins`. Without it it is a
   * type error.
   */
  readonly equals?: Needs<PluginNames<P>, "dirty", Equals>;
  /**
   * Called when a plugin hook throws, with the plugin's name. The write and
   * the other plugins carry on. Defaults to throwing the error on a later
   * task, where the page's error handler sees it.
   */
  readonly onPluginError?: PluginErrorHandler;
  /**
   * How listeners wake. The full entry always wakes per field, so this
   * changes nothing here. It is accepted so a form written for `/mini`
   * with `subscribe: perField()` moves to the full entry by its import.
   */
  readonly subscribe?: Subscribe;
  /**
   * The parts of the adapter's field types and fieldsets, which may attach
   * to any store this makes. A fieldset made later adds its own. Internal.
   */
  readonly "~parts"?: readonly Part[];
}

/** The context `onSubmit` gets. Each submit gets a new one. */
export interface SubmitContext<V, E = FormError, I = undefined> {
  /** The store being submitted. Its result type is left `unknown` so `R` is inferred from what `onSubmit` returns. */
  readonly store: FormStore<V, E, I>;
  /** The intent passed to `submit`. Annotate it on `onSubmit`'s parameter to set the form's intent type. */
  readonly intent: I;
  /** Aborts when the form is reset while this submit runs. */
  readonly signal: PlatformAbortSignal;
  /** The form value as it was when validation passed, before any schema transform. */
  readonly input: DeepReadonly<V>;
}

/** A definition's `validate`. */
export interface DefinitionValidate<V, E> {
  /** A validator for the whole value, from `formValidator`. Its errors land on the fields its `ErrorMap` names. */
  readonly form?: FormValidatorSet<V, E>;
  /** Field validators shaped like the value, from `fieldValidators`. */
  readonly fields?: FieldValidatorSet<V, E>;
}

/**
 * Definition settings that don't depend on where the value type comes from.
 * `P` is the shared plugin list, which decides whether `equals` is allowed.
 */
export interface DefinitionOptions<V, O, E, I, R, P extends Plugins = []> {
  /** Validation for this form. */
  readonly validate?: DefinitionValidate<V, E>;
  /** When errors show. Defaults to the shared setting. */
  readonly show?: Show;
  /** The dirty comparison, asked before the shared one. It needs `dirty()`. Without it it is a type error. */
  readonly equals?: Needs<PluginNames<P>, "dirty", Equals>;
  /** Fields that start disabled. */
  readonly disabled?: Flags<V>;
  /** Fields that start read-only. */
  readonly readOnly?: Flags<V>;
  /**
   * Runs when a submit passes validation. `value` is the schema's output when
   * the form has a schema. Otherwise it is a copy of the form value, which
   * `onSubmit` may change without touching the store. What it returns or
   * resolves to becomes `succeeded.result`. What it throws becomes
   * `failed.error`, untouched.
   */
  readonly onSubmit?: (value: O, ctx: SubmitContext<V, E, I>) => R | Promise<R>;
}

/**
 * The value type of a form with schema `S`. When a schema plugin in `P`
 * accepts the schema it is the `Draft` of the schema's input type, since the
 * plugin's defaults leave fields such as numbers undefined. Otherwise it is
 * the schema's input type.
 */
export type SchemaValue<S extends StandardSchemaV1, P extends Plugins> =
  HasSchemaPlugin<S, P> extends true ? Draft<StandardSchemaV1.InferInput<S>> : StandardSchemaV1.InferInput<S>;

/**
 * The schema part of a definition whose schema no installed schema plugin
 * accepts. Nothing gives the schema's defaults, so `defaultValues` is
 * required and complete. Leaving it out is a type error that names this
 * type, which says what to do.
 */
export interface NoSchemaPlugin<S extends StandardSchemaV1> {
  /** The schema. Fixed for the life of the definition. */
  readonly schema: S;
  /** The starting value. Required because no installed schema plugin accepts this schema's type. */
  readonly defaultValues: StandardSchemaV1.InferInput<S>;
}

/**
 * A definition with a schema. The schema validates the whole value, as
 * `validate.form` would, and sets the value type (see `SchemaValue`). Any
 * Standard Schema works.
 *
 * When a schema plugin in `P` accepts the schema's type, `defaultValues` is
 * optional and deep partial, and overrides the plugin's defaults. Otherwise
 * it is required and complete (see `NoSchemaPlugin`).
 */
export type SchemaDefinition<S extends StandardSchemaV1, P extends Plugins, E, I, R, D extends Plugins = []> = (SchemaPluginIn<
  S,
  P,
  D
> extends true
  ? {
      /** The schema. Fixed for the life of the definition. */
      readonly schema: S;
      /** Values that override the schema plugin's defaults. Any subset, at any depth. */
      readonly defaultValues?: DeepPartial<StandardSchemaV1.InferInput<S>>;
    }
  : NoSchemaPlugin<S>) &
  DefinitionOptions<
    SchemaPluginIn<S, P, D> extends true ? Draft<StandardSchemaV1.InferInput<S>> : StandardSchemaV1.InferInput<S>,
    StandardSchemaV1.InferOutput<S>,
    E,
    I,
    R,
    Combined<P, D>
  >;

/**
 * `HasSchemaPlugin` for the shared plugins `P` and the definition's own `D`.
 * It asks `P` first: while `define` infers `D`, a check against both can't
 * resolve, and `fieldValidators` and `formValidator` inside the config would
 * take the schema's input type instead of its `Draft`. Internal.
 */
type SchemaPluginIn<S extends StandardSchemaV1, P extends Plugins, D extends Plugins> =
  HasSchemaPlugin<S, P> extends true ? true : HasSchemaPlugin<S, Combined<P, D>>;

/**
 * A definition without a schema. `defaultValues` is required and sets the
 * value type, with its literals widened (see `Widened`).
 */
export type PlainDefinition<V, E, I, R, P extends Plugins = []> = {
  /** No schema. */
  readonly schema?: never;
  /** The starting value. Its type, widened, is the form's value type unless one is given explicitly. */
  readonly defaultValues: V;
} & DefinitionOptions<NoInfer<Widened<V>>, NoInfer<Widened<V>>, E, I, R, P>;

/** Per-instance settings for `createStore`. `X` is the instance's own plugins. */
export interface StoreInstance<X extends Plugins = Plugins> {
  /**
   * The store id, which prefixes every handle id. Give one that is stable
   * across server and client. Defaults to `"form"`, so two stores on one page
   * need distinct ids for their DOM ids to be unique.
   */
  readonly id?: string;
  /**
   * Plugins for this store only, such as a binding to a store one component
   * made. They run after the shared plugins and the definition's, and their
   * APIs are on the store's `plugins` too.
   */
  readonly plugins?: X;
}

/**
 * A form type that makes stores. Defining a form has no side effects. `P`
 * is every plugin its stores get, the shared ones and the definition's own.
 */
export interface FormDefinition<V, E = FormError, I = undefined, R = unknown, O = void, P extends Plugins = []> {
  /**
   * Makes a new store. `options` goes to the definition's function form. A
   * definition made from a plain config has `O` of `void`, so it takes no
   * options.
   */
  createStore<const X extends Plugins = []>(
    options: O,
    instance?: StoreInstance<X & PluginsFor<V> & RequiresMet<X, PluginNames<Combined<P, X>>>>,
  ): FormStore<V, E, I, R, PluginApis<Combined<P, X>>, PluginNames<Combined<P, X>>>;
}

/**
 * A definition's config with `plugins`, the plugins it installs for itself.
 * `V` is the form's value type, which a plugin that names one, such as
 * `bind`, must fit. `Installed` is every plugin name the form has, which
 * what these plugins require must be among.
 */
export type WithPlugins<T, D extends Plugins, V, Installed extends string = PluginNames<D>> = T & {
  /**
   * Plugins for this form only, such as one bound to an outside store this
   * form alone uses. Any kind of plugin goes here, as in the shared list.
   * They run after the shared ones. What the form gets is both lists
   * together: `schema` and `validate` are checked against both, and the
   * APIs of both are on the store's `plugins`.
   */
  readonly plugins?: D & PluginsFor<V> & RequiresMet<D, Installed>;
};

/** The plugins a definition's stores get: the shared ones, then the definition's own. */
export type Combined<P extends Plugins, D extends Plugins> = readonly [...P, ...D];

/**
 * Defines forms. Three cases decide where the value type comes from:
 * 1. A `schema` that an installed schema plugin accepts: the value type is
 *    the `Draft` of the schema's input type, so fields the plugin starts
 *    undefined are typed that way, and `defaultValues` is optional and deep
 *    partial. `onSubmit` still gets the schema's output type.
 * 2. Any other Standard Schema: the value type comes from the schema and
 *    `defaultValues` is required and complete.
 * 3. No `schema`: `defaultValues` is required and sets the value type, or
 *    give it explicitly as `define<V>(...)`. Literals from `satisfies` or
 *    `as const` widen, so `false` becomes `boolean` (see `Widened`).
 *
 * Plugins count from the shared list `P` and the definition's own `plugins`.
 *
 * `R` is inferred from what `onSubmit` returns. `I` is inferred from the
 * annotation on `onSubmit`'s `ctx.intent` and defaults to `undefined`.
 *
 * Each case also has a function form, `define((options: O) => config)`,
 * which runs once per `createStore(options)`. A plain config has `O` of
 * `void`.
 */
export interface FormsCore<P extends Plugins = [], E = FormError> {
  /**
   * Defines a form from a config, or from a function of per-store options
   * that returns one. `S` comes from `schema` and `V` from `defaultValues`
   * when there is no schema.
   *
   * You normally don't pass `V`. It is inferred from `defaultValues`, or from
   * the schema. TypeScript has no partial type argument inference, so once
   * you pass `V` every type argument you leave out takes its default: `S` is
   * `never`, so the config has no schema, `O` is `void`, `I` is `undefined`,
   * `R` is `unknown` and `D` is empty. Pass `I` and `R` too, as
   * `define<V, never, void, I, R>(...)`, to keep them. `D` is the
   * definition's own plugins, inferred from its `plugins`.
   *
   * Parts after the config attach at the root when each store is made, as
   * `ruled(...)`, or at a field, as `fieldset.at("billing")`. Their
   * plugins must be among the form's.
   */
  define<V = never, S extends StandardSchemaV1 = never, O = void, I = undefined, R = unknown, const D extends Plugins = []>(
    config: DefineConfig<V, S, O, P, E, I, R, D>,
    ...parts: readonly DefineParts<V, S, P, D>[]
  ): FormDefinition<DefinedValue<V, S, Combined<P, D>>, E, I, R, O, Combined<P, D>>;
}

/**
 * What `define` takes after the config: parts of the form's plugins, `P`
 * shared and `D` the definition's own, that fit its value. The value comes
 * from the shared plugins only: TypeScript types the parts before it has
 * read `D`, and a schema plugin among `D` would make it the schema's input
 * rather than its `Draft`. Internal.
 */
export type DefineParts<V, S extends StandardSchemaV1, P extends Plugins, D extends Plugins> = NamedParts<
  PluginNames<Combined<P, D>>,
  NoInfer<DefinedValue<V, S, P>>
>;

/** What `define` takes: a config, or a function of per-store options that returns one. `P` is the shared plugins and `D` the definition's own. */
export type DefineConfig<V, S extends StandardSchemaV1, O, P extends Plugins, E, I, R, D extends Plugins> =
  | WithPlugins<Definition<V, S, P, E, I, R, D>, D, NoInfer<DefinedValue<V, S, Combined<P, D>>>, PluginNames<Combined<P, D>>>
  | ((options: O) => WithPlugins<Definition<V, S, P, E, I, R, D>, D, NoInfer<DefinedValue<V, S, Combined<P, D>>>, PluginNames<Combined<P, D>>>);

/**
 * A definition's config: `SchemaDefinition` when `S` is a schema,
 * `PlainDefinition` when it is `never`. `P` is the shared plugins and `D`
 * the definition's own.
 */
export type Definition<V, S extends StandardSchemaV1, P extends Plugins, E, I, R, D extends Plugins = []> = [S] extends [never]
  ? PlainDefinition<V, E, I, R, Combined<P, D>>
  : SchemaDefinition<S, P, E, I, R, D>;

/** The value type of a definition: `SchemaValue` with a schema, or `Widened<V>` without one. */
export type DefinedValue<V, S extends StandardSchemaV1, P extends Plugins = []> = [S] extends [never] ? Widened<V> : SchemaValue<S, P>;

/**
 * Core's entry point. Framework adapters wrap it in their own `createForms`.
 * `P` is inferred from `plugins` as a tuple, and `E` from `mapError`,
 * defaulting to `FormError`.
 */
export type CreateFormsCore = <const P extends Plugins = [], E = FormError>(config?: FormsConfig<P, E>) => FormsCore<P, E>;
