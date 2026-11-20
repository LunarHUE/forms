import type { ErrorMap, FormError, Many } from "./errors.js";
import type { Path } from "./path.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import type { AnyFormStore } from "./store.js";
import type { ChildValue, IsUnknown, ItemOf, KeysOf, PlatformAbortSignal, ShapeOf } from "./value.js";

/**
 * When a validator first runs. `"input"` runs it on the first write,
 * `"blur"` on the first blur, `"submit"` on the first submit. After its first
 * run it runs on every input.
 */
export type ValidateTiming = "input" | "blur" | "submit";

/**
 * Where a validator came from: the definition's `schema`, its
 * `validate.form`, or a field validator from `validate.fields` or
 * `registerValidator`. A field validator that is a Standard Schema is still
 * `"field"`.
 */
export type ValidatorKind = "schema" | "form" | "field";

/**
 * What a validator returns. `undefined`, `null` or an empty list mean the
 * value passed. Anything else is one error or a list of errors.
 */
export type ValidatorResult<E> = Many<E> | undefined | null;

/** What a validator gets besides the value. */
export interface ValidatorContext<E = unknown> {
  /**
   * Aborts when a newer run of the same validator starts, when the field is
   * reset, and when the validator is removed. Pass it to `fetch` and the like.
   */
  readonly signal: PlatformAbortSignal;
  /** The stable path of the field the validator runs on. */
  readonly path: Path;
  /** The store the field belongs to. */
  readonly store: AnyFormStore<E>;
}

/**
 * Checks one field's value. Returning a value makes it sync. Returning a
 * promise makes it async: when a newer run starts before an older one
 * settles, the newer run wins, the older run's `signal` aborts, and its
 * result is dropped. A validator that throws or rejects produces an error
 * through the form's `mapError`. Returned errors are used as they are.
 */
export type Validator<V, E = FormError> = (
  value: V,
  ctx: ValidatorContext<E>,
) => ValidatorResult<E> | Promise<ValidatorResult<E>>;

/**
 * A Standard Schema wrapped by `debounced`, `validateOn` or
 * `recheckOnSubmit`. At runtime it is a function that runs the schema, and
 * its issues go through `mapError` as the schema's would. `In` is the
 * schema's input type.
 */
export interface WrappedSchema<In = unknown> {
  readonly "~schema": true;
  /** Carries the schema's input type. Types only. */
  readonly "~types"?: { readonly input: In } | undefined;
}

/**
 * Anything accepted where a field validator goes: a validator function, a
 * Standard Schema whose input type is the field's value type, or either one
 * wrapped by `debounced`, `validateOn` or `recheckOnSubmit`. A schema's
 * issues go through `mapError`.
 */
export type ValidatorInput<V, E = FormError> = Validator<V, E> | StandardSchemaV1<V, unknown> | WrappedSchema<V>;

/** What a form validator returns. `undefined` and `null` mean the form passed. */
export type FormValidatorResult<E> = ErrorMap<E> | undefined | null;

/**
 * Checks the whole form value and returns errors addressed by field. Sync or
 * async, with the same latest-run-wins rule as `Validator`.
 */
export type FormValidator<V, E = FormError> = (
  value: V,
  ctx: ValidatorContext<E>,
) => FormValidatorResult<E> | Promise<FormValidatorResult<E>>;

/**
 * Anything accepted as `validate.form`: a form validator, a Standard Schema
 * for the whole value, or either one wrapped by `debounced`, `validateOn` or
 * `recheckOnSubmit`. A schema's issues land on the fields their paths point
 * at.
 */
export type FormValidatorInput<V, E = FormError> = FormValidator<V, E> | StandardSchemaV1<V, unknown> | WrappedSchema<V>;

/**
 * Field validators shaped like the value. At any node it is a
 * `ValidatorInput` for that node's value. At an object it can instead be a
 * record of child entries. At an array it can instead be a one-element tuple
 * whose entry applies to every item.
 */
export type FieldValidators<V, E = FormError> = ValidatorInput<V, E> | NestedValidators<V, E>;

/** The nested forms of `FieldValidators`: a record at an object, a one-element tuple at an array. */
export type NestedValidators<V, E = FormError> =
  IsUnknown<V> extends true
    ? never
    : ShapeOf<V> extends "array"
      ? readonly [FieldValidators<ItemOf<V>, E>]
      : ShapeOf<V> extends "object"
        ? ValidatorRecord<V, E>
        : never;

/**
 * Child entries of an object node, each optional. The `~standard` key is
 * excluded so a Standard Schema is never read as a record.
 */
export type ValidatorRecord<V, E = FormError> = {
  readonly [K in KeysOf<V>]?: FieldValidators<ChildValue<V, K>, E>;
} & { readonly "~standard"?: never };
