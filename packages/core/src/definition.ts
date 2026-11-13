import type { FormError, MapError, Show } from "./errors.js";
import type { Path } from "./path.js";
import type { AnyPlugin, PluginErrorHandler } from "./plugin.js";
import type { HasAdapter, SchemaAdapter } from "./schema-adapter.js";
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
export interface FormsConfig<A extends readonly SchemaAdapter<never>[] = [], E = FormError> {
  /**
   * The schema adapters. A schema whose type one of them supports gets
   * automatic defaults, so `defaultValues` becomes optional for it.
   */
  readonly schemas?: A;
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
   * Plugins every form gets, from `definePlugin` in
   * `@lunarhue/forms-core/plugins`. They run in this order, except where a
   * plugin's `after` says otherwise, and before a definition's own plugins.
   */
  readonly plugins?: readonly AnyPlugin[];
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

/** Definition settings that don't depend on where the value type comes from. */
export interface DefinitionOptions<V, O, E, I, R> {
  /** Validation for this form. */
  readonly validate?: {
    /** When this form's validators first run. Defaults to the shared timing. */
    readonly on?: ValidateTiming;
    /** A validator for the whole value. Its errors land on the fields its `ErrorMap` names. */
    readonly form?: FormValidatorInput<V, E>;
    /** Field validators shaped like the value. */
    readonly fields?: FieldValidators<V, E>;
  };
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
  /** Plugins for this form only. They run after the shared ones. */
  readonly plugins?: readonly AnyPlugin[];
}

/**
 * The value type of a form with schema `S`. When a registered adapter
 * supports the schema's type it is the `Draft` of the schema's input type,
 * since the adapter's defaults leave fields such as numbers undefined.
 * Otherwise it is the schema's input type.
 */
export type SchemaValue<S extends StandardSchemaV1, A extends readonly SchemaAdapter<never>[]> =
  HasAdapter<S, A> extends true ? Draft<StandardSchemaV1.InferInput<S>> : StandardSchemaV1.InferInput<S>;

/**
 * A definition with a schema. The schema validates the whole value, as
 * `validate.form` would, and sets the value type (see `SchemaValue`). When a
 * registered adapter supports the schema's type, `defaultValues` is optional
 * and deep partial, and overrides the adapter's defaults. Otherwise it is
 * required and complete.
 */
export type SchemaDefinition<S extends StandardSchemaV1, A extends readonly SchemaAdapter<never>[], E, I, R> = {
  /** The schema. Fixed for the life of the definition. */
  readonly schema: S;
} & (HasAdapter<S, A> extends true
  ? {
      /** Values that override the adapter's defaults. Any subset, at any depth. */
      readonly defaultValues?: DeepPartial<StandardSchemaV1.InferInput<S>>;
    }
  : {
      /** The starting value. Required because no registered adapter supports this schema's type. */
      readonly defaultValues: StandardSchemaV1.InferInput<S>;
    }) &
  DefinitionOptions<SchemaValue<S, A>, StandardSchemaV1.InferOutput<S>, E, I, R>;

/** A definition without a schema. `defaultValues` is required and sets the value type. */
export type PlainDefinition<V, E, I, R> = {
  /** No schema. */
  readonly schema?: never;
  /** The starting value. Its type is the form's value type unless one is given explicitly. */
  readonly defaultValues: V;
} & DefinitionOptions<NoInfer<V>, NoInfer<V>, E, I, R>;

/** Per-instance settings for `createStore`. */
export interface StoreInstance {
  /**
   * The store id, which prefixes every handle id. Give one that is stable
   * across server and client. Defaults to `"form"`, so two stores on one page
   * need distinct ids for their DOM ids to be unique.
   */
  readonly id?: string;
}

/** A form type that makes stores. Defining a form has no side effects. */
export interface FormDefinition<V, E = FormError, I = undefined, R = unknown, O = void> {
  /**
   * Makes a new store. `options` goes to the definition's function form. A
   * definition made from a plain config has `O` of `void`, so it takes no
   * options.
   */
  createStore(options: O, instance?: StoreInstance): FormStore<V, E, I, R>;
}

/**
 * Defines forms. Three cases decide where the value type comes from:
 * 1. A `schema` whose type a registered adapter supports: the value type is
 *    the `Draft` of the schema's input type, so fields the adapter starts
 *    undefined are typed that way, and `defaultValues` is optional and deep
 *    partial. `onSubmit` still gets the schema's output type.
 * 2. A `schema` with no adapter for it: the value type comes from the schema
 *    and `defaultValues` is required and complete.
 * 3. No `schema`: `defaultValues` is required and sets the value type, or
 *    give it explicitly as `define<V>(...)`.
 *
 * `R` is inferred from what `onSubmit` returns. `I` is inferred from the
 * annotation on `onSubmit`'s `ctx.intent` and defaults to `undefined`.
 *
 * Each case also has a function form, `define((options: O) => config)`,
 * which runs once per `createStore(options)`. A plain config has `O` of
 * `void`.
 */
export interface FormsCore<A extends readonly SchemaAdapter<never>[] = [], E = FormError> {
  /**
   * Defines a form from a config, or from a function of per-store options
   * that returns one. `S` comes from `schema` and `V` from `defaultValues`
   * when there is no schema.
   *
   * You normally don't pass `V`. It is inferred from `defaultValues`, or from
   * the schema. TypeScript has no partial type argument inference, so once
   * you pass `V` every type argument you leave out takes its default: `S` is
   * `never`, so the config has no schema, `O` is `void`, `I` is `undefined`
   * and `R` is `unknown`. Pass `I` and `R` too, as
   * `define<V, never, void, I, R>(...)`, to keep them.
   */
  define<V = never, S extends StandardSchemaV1 = never, O = void, I = undefined, R = unknown>(
    config: Definition<V, S, A, E, I, R> | ((options: O) => Definition<V, S, A, E, I, R>),
  ): FormDefinition<DefinedValue<V, S, A>, E, I, R, O>;
}

/** A definition's config: `SchemaDefinition` when `S` is a schema, `PlainDefinition` when it is `never`. */
export type Definition<V, S extends StandardSchemaV1, A extends readonly SchemaAdapter<never>[], E, I, R> = [S] extends [never]
  ? PlainDefinition<V, E, I, R>
  : SchemaDefinition<S, A, E, I, R>;

/** The value type of a definition: `SchemaValue` with a schema, or `V` without one. */
export type DefinedValue<V, S extends StandardSchemaV1, A extends readonly SchemaAdapter<never>[] = []> = [S] extends [never]
  ? V
  : SchemaValue<S, A>;

/**
 * Core's entry point. Framework adapters wrap it in their own `createForms`.
 * `E` is inferred from `mapError` and defaults to `FormError`.
 */
export type CreateFormsCore = <const A extends readonly SchemaAdapter<never>[] = [], E = FormError>(
  config?: FormsConfig<A, E>,
) => FormsCore<A, E>;
