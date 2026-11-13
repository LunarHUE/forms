import type { FormError } from "./errors.js";
import type { FieldMeta, FormMeta } from "./index.js";
import type { DeepReadonly, ShapeOf } from "./value.js";

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
  /** The part of `errors` the form's `show` setting lets through now. */
  readonly shownErrors: readonly E[];
  /** True when this field has a validation error. User-set errors don't count. */
  readonly invalid: boolean;
  /** True once the field has been blurred or `setTouched` set it. Reset clears it. */
  readonly touched: boolean;
  /** True once a write counted as a user edit at or below this field. Reset clears it. */
  readonly edited: boolean;
  /** True when the value at or below this field differs from its baseline. */
  readonly dirty: boolean;
  /** True while a validator at this field is waiting or running. */
  readonly validating: boolean;
  /** True when this field or one above it is disabled. */
  readonly disabled: boolean;
  /** True when this field or one above it is read-only. */
  readonly readOnly: boolean;
  /**
   * Plugin state by plugin name. Missing until a plugin sets some on this
   * field. Plugins declare their slot types on `FieldMeta`.
   */
  readonly meta?: Readonly<Partial<FieldMeta>>;
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
 * have it.
 */
export type FieldSnapshot<V, E = FormError> = FieldSnapshotBase<V, E> &
  (ShapeOf<V> extends "array" ? ArraySnapshotMembers : ShapeOf<V> extends "any" ? UnknownSnapshotMembers : unknown);

/**
 * Where a form's submit stands. `failed` carries the value `onSubmit` threw,
 * untouched. Only `succeeded` carries a result.
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
 */
export interface FormSnapshot<I = undefined, R = unknown> {
  /** True when no field has a validation error. User-set errors don't count. */
  readonly valid: boolean;
  /** True while any validator in the form is waiting or running. */
  readonly validating: boolean;
  /** True when any value in the form differs from its baseline. */
  readonly dirty: boolean;
  /** True while a submit runs. The same as `submission.status === "submitting"`. */
  readonly submitting: boolean;
  /** Where the latest submit stands. */
  readonly submission: Submission<I, R>;
  /** How many submits have started, counting ones that ended invalid. */
  readonly submitCount: number;
  /**
   * Plugin state by plugin name. Missing until a plugin sets some on the
   * form. Plugins declare their slot types on `FormMeta`.
   */
  readonly meta?: Readonly<Partial<FormMeta>>;
}
