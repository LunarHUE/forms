import type { ErrorMap, FormError } from "./errors.js";
import type { AnyFieldHandle, FieldHandle, ResetOptions } from "./handle.js";
import type { Path } from "./path.js";
import type { FieldSnapshot, FormSnapshot, Submission } from "./snapshot.js";
import type { ValidatorInput } from "./validator.js";

/** One dirty leaf. An array that changed length or order counts as one leaf. */
export interface Change {
  /** The leaf's stable path. */
  readonly path: Path;
  /** The baseline value at the leaf. */
  readonly baseline: unknown;
  /** The current value at the leaf. */
  readonly value: unknown;
}

/** A disabled field with a validation error, as `disabledInvalid` lists it. */
export interface DisabledInvalid<E = FormError> {
  /** The field's handle. */
  readonly field: AnyFieldHandle<E>;
  /** The field's dotted value path, as the snapshot's `name`. */
  readonly name: string;
  /** Every error on the field, as the snapshot's `errors`. The form's `show` setting doesn't filter it. */
  readonly errors: readonly E[];
}

/**
 * The arguments `submit` takes. When `undefined` is a valid intent the
 * argument is optional. Otherwise `submit()` with no argument is a type error.
 */
export type IntentArgs<I> = undefined extends I ? [intent?: I] : [intent: I];

/**
 * A form's state and commands, as a plain external store. One store holds
 * one form instance. Framework adapters read it through `subscribe` and the
 * snapshot getters, the same way `useSyncExternalStore` does.
 *
 * Adapters rely on these guarantees:
 * - Creating a store has no side effects. No timers, listeners or validation
 *   run until something subscribes. Unsubscribing everything and subscribing
 *   again works.
 * - `getSnapshot` returns the identical object on every call until that
 *   field changes, so `===` tells whether it changed.
 * - A write updates every affected snapshot first, then calls listeners
 *   synchronously before it returns. One write wakes each listener once.
 * - The server snapshot is the initial snapshot.
 */
// The default is an object type with no keys: a store with no plugin APIs has nothing on `plugins`.
// oxlint-disable-next-line typescript/no-empty-object-type
export interface FormStore<V, E = FormError, I = undefined, R = unknown, A = {}> {
  /** The form instance's id. Every handle id starts with it. */
  readonly id: string;
  /** The handle for the whole value. */
  readonly root: FieldHandle<V, E>;

  /**
   * Calls `listener` after any write that changes the snapshot of the field
   * at `path`. Returns the function that unsubscribes. The listener gets no
   * arguments: read the new state with `getSnapshot`.
   */
  subscribe(path: Path, listener: () => void): () => void;
  /**
   * Returns the snapshot of the field at stable path `path`. It returns the
   * identical object until that field changes. A path whose item was removed
   * keeps returning that item's last snapshot, so a component that is still
   * unmounting can read it. The store keeps those snapshots until the store
   * itself is freed.
   */
  getSnapshot(path: Path): FieldSnapshot<unknown, E>;
  /** Returns the snapshot the field had when the store was created, for server rendering and hydration. */
  getServerSnapshot(path: Path): FieldSnapshot<unknown, E>;

  /** Calls `listener` after any write that changes the form snapshot. Returns the function that unsubscribes. */
  subscribeForm(listener: () => void): () => void;
  /** Returns the form snapshot. It returns the identical object until a member changes. */
  getFormSnapshot(): FormSnapshot<I, R>;
  /** Returns the form snapshot the store started with. */
  getServerFormSnapshot(): FormSnapshot<I, R>;
  /**
   * Returns the current form snapshot. The same as `getFormSnapshot`, named
   * for reads in event handlers and effects. Never call it during render.
   */
  peek(): FormSnapshot<I, R>;

  /**
   * Runs `fn` and returns what it returns. Writes inside it update
   * snapshots as they happen, but listeners wait until `fn` returns, and
   * each listener is called once. Batches nest: listeners run when the
   * outermost batch returns.
   */
  batch<T>(fn: () => T): T;

  /**
   * Validates the form and, when it is valid, calls `onSubmit`. Resolves to
   * the `Submission` the submit ended in. While a submit runs, a second call
   * returns the running one.
   */
  submit(...args: IntentArgs<I>): Promise<Submission<I, R>>;
  /**
   * Calls `event.preventDefault()` when an event is given, then submits with
   * an undefined intent. Pass it to the form element's submit event. It never
   * rejects: the outcome is in the form snapshot's `submission`.
   */
  handleSubmit(event?: { preventDefault(): void }): Promise<void>;

  /**
   * Replaces user errors across the form. Errors under `fields` land on the
   * field with that dotted name. User errors don't block submit and clear
   * when the field's value is next written as a user edit.
   */
  setErrors(errors: ErrorMap<E>): void;
  /**
   * Runs every validator now, skipping debounce and timing. Resolves true
   * when the form has no validation error.
   */
  validate(): Promise<boolean>;
  /**
   * Puts the whole form back to its baseline, or to the initial value with
   * `to: "initial"`, and clears touched, edited and error state. A running
   * submit's `signal` aborts.
   */
  reset(options?: ResetOptions): void;
  /**
   * Adds a validator at stable path `path`. The returned function removes it
   * and the errors it set.
   */
  registerValidator(path: Path, validator: ValidatorInput<unknown, E>): () => void;

  /**
   * Returns the handle at stable path `path`, the same object `at` and
   * `item` return. Returns `undefined` when the path can't name a field: a
   * segment goes into a leaf, or names an item key the array never had.
   */
  fieldAt(path: Path): AnyFieldHandle<E> | undefined;
  /**
   * Returns every dirty leaf at and below `path` (the whole form by default),
   * in value order. A read for event handlers and effects, not render. Empty
   * without `dirty()`.
   */
  changes(path?: Path): readonly Change[];
  /**
   * Returns the first enabled field, in value order, that has a validation
   * error, for the adapter to focus after an invalid submit. Read-only fields
   * count. Disabled ones don't: `disabledInvalid` lists those. Returns
   * `undefined` when there is none. A read for event handlers and effects,
   * not render.
   */
  firstInvalid(): AnyFieldHandle<E> | undefined;
  /**
   * Returns every disabled field, in value order, that has a validation
   * error. Their errors still block submit, but `firstInvalid` skips them, so
   * after an invalid submit the adapter can show these at form level. A field
   * counts as disabled when it or a field above it is. Returns an empty list
   * when there is none. A read for event handlers and effects, not render.
   */
  disabledInvalid(): readonly DisabledInvalid<E>[];
  /**
   * The API of each installed hook plugin that has one, by plugin name:
   * `store.plugins.history.undo()`. A store from a definition types it
   * from the plugin list.
   */
  readonly plugins: A;
}

/**
 * A store of any value, intent and result type. Handles and validators use
 * it so a store of any form fits.
 */
// `any` here lets FormStore<V, E, I, R, A> of every V, I, R and A fit, whatever their variance.
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyFormStore<E = FormError> = FormStore<any, E, any, any, any>;
