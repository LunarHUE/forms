import type { FormError, MapError, Show } from "./errors.js";
import type { Path } from "./path.js";
import type {
  HasSchemaPlugin,
  HasValidation,
  IfValidation,
  PluginApis,
  PluginErrorHandler,
  Plugins,
  SchemaNeedsValidation,
} from "./plugin.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import type { FormStore } from "./store.js";
import type { FieldValidators, FormValidatorInput, ValidateTiming } from "./validator.js";
import type { ChildValue, DeepPartial, DeepReadonly, Draft, IsUnknown, ItemOf, KeysOf, PlatformAbortSignal, ShapeOf } from "./value.js";

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
   *   which give their library's schemas default values and bring the
   *   validation runner;
   * - `validation()` from `@lunarhue/forms-core/validation`, the runner
   *   alone, for function validators and for any other Standard Schema;
   * - hook plugins from `definePlugin` in `@lunarhue/forms-core/plugins`.
   *
   * The list's type decides what `define` accepts: `schema` and `validate`
   * need the runner, a schema a schema plugin accepts makes `defaultValues`
   * optional, and each hook plugin's API shows up on the store's `plugins`. Hook plugins run in this
   * order, except where a plugin's `after` says otherwise, and before a
   * definition's own plugins.
   */
  readonly plugins?: P;
  /**
   * Turns schema issues and thrown validator errors into the error type. Its
   * return type sets `E` for every form. Without it `E` is `FormError`.
   */
  readonly mapError?: MapError<E>;
  /** When validators first run. Defaults to `"blur"`. */
  readonly validate?: ValidateTiming;
  /** When errors show. Defaults to `"touched-or-submitted"`. */
  readonly show?: Show;
  /** The dirty comparison. A form's own `equals` runs first and reaches this one through `next`. */
  readonly equals?: Equals;
  /**
   * Called when a plugin hook throws, with the plugin's name. The write and
   * the other plugins carry on. Defaults to throwing the error on a later
   * task, where the page's error handler sees it.
   */
  readonly onPluginError?: PluginErrorHandler;
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
  /** When this form's validators first run. Defaults to the shared timing. */
  readonly on?: ValidateTiming;
  /** A validator for the whole value. Its errors land on the fields its `ErrorMap` names. */
  readonly form?: FormValidatorInput<V, E>;
  /** Field validators shaped like the value. */
  readonly fields?: FieldValidators<V, E>;
}

/**
 * Definition settings that don't depend on where the value type comes from.
 * `P` is the shared plugin list, which decides whether `validate` is allowed.
 */
export interface DefinitionOptions<V, O, E, I, R, P extends Plugins = []> {
  /**
   * Validation for this form. It needs the validation runner: install
   * `validation()` or a schema plugin. Without one it is a type error.
   */
  readonly validate?: IfValidation<P, DefinitionValidate<V, E>>;
  /** When errors show. Defaults to the shared setting. */
  readonly show?: Show;
  /** The dirty comparison, asked before the shared one. */
  readonly equals?: Equals;
  /** Fields that start disabled. */
  readonly disabled?: Flags<V>;
  /** Fields that start read-only. */
  readonly readOnly?: Flags<V>;
  /**
   * Runs when a submit passes validation. `value` is the schema's output when
   * the form has a schema, and the form value otherwise. What it returns or
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
 * A definition with a schema. The schema validates the whole value, as
 * `validate.form` would, and sets the value type (see `SchemaValue`). Any
 * Standard Schema works, and the validation runner runs it, so `schema`
 * needs the runner, from `validation()` or any schema plugin. Without it,
 * `schema` is a type error that names what to install.
 *
 * When a schema plugin in `P` accepts the schema's type, `defaultValues` is
 * optional and deep partial, and overrides the plugin's defaults. Otherwise
 * it is required and complete.
 */
export type SchemaDefinition<S extends StandardSchemaV1, P extends Plugins, E, I, R> = (HasSchemaPlugin<S, P> extends true
  ? {
      /** The schema. Fixed for the life of the definition. */
      readonly schema: S;
      /** Values that override the schema plugin's defaults. Any subset, at any depth. */
      readonly defaultValues?: DeepPartial<StandardSchemaV1.InferInput<S>>;
    }
  : {
      /** The schema. Fixed for the life of the definition. */
      readonly schema: HasValidation<P> extends true ? S : S & SchemaNeedsValidation;
      /** The starting value. Required because no installed schema plugin accepts this schema's type. */
      readonly defaultValues: StandardSchemaV1.InferInput<S>;
    }) &
  DefinitionOptions<SchemaValue<S, P>, StandardSchemaV1.InferOutput<S>, E, I, R, P>;

/** A definition without a schema. `defaultValues` is required and sets the value type. */
export type PlainDefinition<V, E, I, R, P extends Plugins = []> = {
  /** No schema. */
  readonly schema?: never;
  /** The starting value. Its type is the form's value type unless one is given explicitly. */
  readonly defaultValues: V;
} & DefinitionOptions<NoInfer<V>, NoInfer<V>, E, I, R, P>;

/** Per-instance settings for `createStore`. */
export interface StoreInstance {
  /**
   * The store id, which prefixes every handle id. Give one that is stable
   * across server and client. Defaults to `"form"`, so two stores on one page
   * need distinct ids for their DOM ids to be unique.
   */
  readonly id?: string;
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
  createStore(options: O, instance?: StoreInstance): FormStore<V, E, I, R, PluginApis<P>>;
}

/** A definition's config with `plugins`, the plugins it installs for itself. */
export type WithPlugins<T, D extends Plugins> = T & {
  /**
   * Plugins for this form only, such as one bound to an outside store this
   * form alone uses. Any kind of plugin goes here, as in the shared list.
   * They run after the shared ones. What the form gets is both lists
   * together: `schema` and `validate` are checked against both, and the
   * APIs of both are on the store's `plugins`.
   */
  readonly plugins?: D;
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
 *    `defaultValues` is required and complete. It needs the validation
 *    runner, from `validation()` or any schema plugin.
 * 3. No `schema`: `defaultValues` is required and sets the value type, or
 *    give it explicitly as `define<V>(...)`.
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
   */
  define<V = never, S extends StandardSchemaV1 = never, O = void, I = undefined, R = unknown, const D extends Plugins = []>(
    config: DefineConfig<V, S, O, Combined<P, D>, E, I, R, D>,
  ): FormDefinition<DefinedValue<V, S, Combined<P, D>>, E, I, R, O, Combined<P, D>>;
}

/** What `define` takes: a config, or a function of per-store options that returns one. `C` is every plugin the form gets. */
export type DefineConfig<V, S extends StandardSchemaV1, O, C extends Plugins, E, I, R, D extends Plugins> =
  | WithPlugins<Definition<V, S, C, E, I, R>, D>
  | ((options: O) => WithPlugins<Definition<V, S, C, E, I, R>, D>);

/** A definition's config: `SchemaDefinition` when `S` is a schema, `PlainDefinition` when it is `never`. */
export type Definition<V, S extends StandardSchemaV1, P extends Plugins, E, I, R> = [S] extends [never]
  ? PlainDefinition<V, E, I, R, P>
  : SchemaDefinition<S, P, E, I, R>;

/** The value type of a definition: `SchemaValue` with a schema, or `V` without one. */
export type DefinedValue<V, S extends StandardSchemaV1, P extends Plugins = []> = [S] extends [never] ? V : SchemaValue<S, P>;

/**
 * Core's entry point. Framework adapters wrap it in their own `createForms`.
 * `P` is inferred from `plugins` as a tuple, and `E` from `mapError`,
 * defaulting to `FormError`.
 */
export type CreateFormsCore = <const P extends Plugins = [], E = FormError>(config?: FormsConfig<P, E>) => FormsCore<P, E>;
