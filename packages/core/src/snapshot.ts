import type { FormError } from "./errors.js";
import type { Gate } from "./plugin.js";
import type { DeepReadonly, ShapeOf } from "./value.js";

/** The member dirty tracking adds to field and form snapshots. It is there when the form has `dirty()`. */
export interface DirtyMember {
  /**
   * True when the value differs from its baseline, at or below this field
   * on a field snapshot and anywhere in the form on the form snapshot.
   */
  readonly dirty: boolean;
}

/** The members every field snapshot has. See `FieldSnapshot`. */
export interface FieldSnapshotBase<V, E = FormError> {
  /** The field's current value. */
  readonly value: DeepReadonly<V>;
  /**
   * The field's dotted value path with array indexes, such as
   * `rows.0.title`, for the input's `name` attribute and for `ErrorMap`
   * keys. It lives on the snapshot rather than the handle because it changes:
   * moving, inserting or removing an item changes the index of every item
   * after it, while the item's handle and stable path stay the same.
   */
  readonly name: string;
  /** Every error on this field: validation errors first, then user-set errors. */
  readonly errors: readonly E[];
  /**
   * The errors `setErrors` put on this field, on the store or the handle:
   * the end of `errors`. The validation errors are the rest, so
   * `errors.slice(0, errors.length - userErrors.length)`. They don't block
   * submit and clear on the field's next user edit.
   */
  readonly userErrors: readonly E[];
  /** The part of `errors` the form's `show` setting lets through now. */
  readonly shownErrors: readonly E[];
  /**
   * True when this field has an error, from validation or `setErrors`. Only
   * validation errors block submit: the form snapshot's `valid` counts those
   * alone.
   */
  readonly invalid: boolean;
  /** True once the field has been blurred or `setTouched` set it. Reset clears it. */
  readonly touched: boolean;
  /** True once a write counted as a user edit at or below this field. Reset clears it. */
  readonly edited: boolean;
  /** True while a validator at this field is waiting or running. */
  readonly validating: boolean;
  /** True when this field or one above it is disabled. */
  readonly disabled: boolean;
  /** True when this field or one above it is read-only. */
  readonly readOnly: boolean;
  /**
   * Plugin state by plugin name. Missing until a plugin sets some on this
   * field. Read a plugin's slot, typed, with the plugin's `meta` reader:
   * `rules.meta(snapshot)`.
   */
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** The extra member on an array field's snapshot. */
export interface ArraySnapshotMembers {
  /**
   * The stable keys of the items, in their current order. Pass one to the
   * array handle's `item(key)`. The list is empty while the array is missing.
   */
  readonly keys: readonly string[];
}

/** The extra member on a snapshot whose value type is unknown. It is present when the field is an array. */
export interface UnknownSnapshotMembers {
  /** The stable item keys in order, when the field is an array. */
  readonly keys?: readonly string[];
}

/**
 * One field's state at one moment, as a single deeply immutable object.
 *
 * `getSnapshot` and `peek` return the identical object on every call until
 * something in this snapshot changes, so `===` tells whether anything
 * changed. Snapshots are frozen in development builds. An array item that
 * has been removed keeps returning its last snapshot, so a component that
 * still holds its handle can finish rendering.
 *
 * Array fields also have `keys`. A field whose value type is `unknown` may
 * have it. `N` is the names of the form's plugins: with `dirty()` among
 * them the snapshot has `dirty`, and without it reading `dirty` is a type
 * error.
 */
export type FieldSnapshot<V, E = FormError, N extends string = never> = FieldSnapshotBase<V, E> &
  Gate<N, "dirty", DirtyMember> &
  (ShapeOf<V> extends "array" ? ArraySnapshotMembers : ShapeOf<V> extends "any" ? UnknownSnapshotMembers : unknown);

/**
 * Where a form's submit stands. `invalid` is a submit that validation or a
 * plugin stopped, or one whose `onSubmit` left errors from `setErrors`.
 * `failed` carries the value `onSubmit` threw, untouched. Only `succeeded`
 * carries a result.
 */
export type Submission<I = undefined, R = unknown> =
  | { readonly status: "idle" }
  | { readonly status: "submitting"; readonly intent: I }
  | { readonly status: "invalid" }
  | { readonly status: "failed"; readonly error: unknown }
  | { readonly status: "succeeded"; readonly result: R };

/**
 * The form's own state at one moment. The same identity rule as
 * `FieldSnapshot` holds: the same object until one of these members changes.
 * `N` is the names of the form's plugins: with `dirty()` among them the
 * snapshot has `dirty`, and without it reading `dirty` is a type error.
 */
export type FormSnapshot<I = undefined, R = unknown, N extends string = never> = FormSnapshotBase<I, R> & Gate<N, "dirty", DirtyMember>;

/** The members every form snapshot has. See `FormSnapshot`. */
export interface FormSnapshotBase<I = undefined, R = unknown> {
  /**
   * True when no field has a validation error. Errors from `setErrors` don't
   * count, though they make the field snapshot's `invalid` true.
   */
  readonly valid: boolean;
  /** True while any validator in the form is waiting or running. */
  readonly validating: boolean;
  /** True while a submit runs. The same as `submission.status === "submitting"`. */
  readonly submitting: boolean;
  /** Where the latest submit stands. */
  readonly submission: Submission<I, R>;
  /** How many submits have started, counting ones that ended invalid. */
  readonly submitCount: number;
  /**
   * Plugin state by plugin name. Missing until a plugin sets some on the
   * form. Read a plugin's slot, typed, with the plugin's `formMeta` reader:
   * `rules.formMeta(snapshot)`.
   */
  readonly meta?: Readonly<Record<string, unknown>>;
}
