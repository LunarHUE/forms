import type { ErrorMap, FormError } from "./errors.js";
import type { NamedAnyFieldHandle, NamedFieldHandle, ResetOptions } from "./handle.js";
import type { Path } from "./path.js";
import type { Gate } from "./plugin.js";
import type { FieldSnapshot, FormSnapshot, Submission } from "./snapshot.js";
import type { ValidatorInput } from "./validator.js";

/**
 * Options for the store's `reset`: `to` names the value to go back to, and
 * `values` gives new values that also become the baseline. Pass one or the
 * other.
 */
export type FormResetOptions<V> = (ResetOptions & { readonly values?: never }) | ResetValues<V>;

/** `reset` options that set new values and move the baseline to them. */
export interface ResetValues<V> {
  /**
   * The values the form takes. They become the baseline, so the form is
   * clean afterwards and a later `reset()` comes back to them. The initial
   * value stays the one the store started with.
   */
  readonly values: V;
  readonly to?: never;
}

/** One dirty leaf. An array that changed length or order counts as one leaf. */
export interface Change {
  /** The leaf's stable path. */
  readonly path: Path;
  /** The baseline value at the leaf. */
  readonly baseline: unknown;
  /** The current value at the leaf. */
  readonly value: unknown;
}

/** A field with errors, as `invalidFields` and `disabledInvalid` list it. */
export interface InvalidField<E = FormError> {
  /** The field's handle. */
  readonly field: NamedAnyFieldHandle<E>;
  /** The field's dotted value path, as the snapshot's `name`. */
  readonly name: string;
  /** Every error on the field, as the snapshot's `errors`. The form's `show` setting doesn't filter it. */
  readonly errors: readonly E[];
}

/**
 * A field's validation errors by the kind of validator that set them, as
 * `errorsByKind` returns them. Each list keeps the order the snapshot's
 * `errors` has. Errors from `setErrors` are the snapshot's `userErrors`.
 */
export interface ErrorsByKind<E = FormError> {
  /** From the definition's `schema`. */
  readonly schema: readonly E[];
  /** From the definition's `validate.form`. */
  readonly form: readonly E[];
  /** From field validators: `validate.fields` and `registerValidator`. */
  readonly field: readonly E[];
}

/** A disabled field with errors, as `disabledInvalid` lists it. The same shape as `InvalidField`. */
export type DisabledInvalid<E = FormError> = InvalidField<E>;

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
 *
 * `A` is the plugins' APIs, by plugin name, and `N` the names of the
 * plugins. With `dirty()` among them the store has `changes` and its
 * snapshots have `dirty`. Without it reading either is a type error.
 */
// The default is an object type with no keys: a store with no plugin APIs has nothing on `plugins`.
// oxlint-disable-next-line typescript/no-empty-object-type
export type FormStore<V, E = FormError, I = undefined, R = unknown, A = {}, N extends string = never> = FormStoreBase<V, E, I, R, A, N> &
  Gate<N, "dirty", DirtyStoreMembers>;

/** What dirty tracking adds to a store. It is there when the form has `dirty()`. */
export interface DirtyStoreMembers {
  /**
   * Returns every dirty leaf at and below `path` (the whole form by default),
   * in value order. A read for event handlers and effects, not render.
   */
  changes(path?: Path): readonly Change[];
}

/** The members every store has. See `FormStore`. */
// oxlint-disable-next-line typescript/no-empty-object-type
export interface FormStoreBase<V, E = FormError, I = undefined, R = unknown, A = {}, N extends string = never> {
  /** The form instance's id. Every handle id starts with it. */
  readonly id: string;
  /** The handle for the whole value. */
  readonly root: NamedFieldHandle<V, E, N>;

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
  getSnapshot(path: Path): FieldSnapshot<unknown, E, N>;
  /** Returns the snapshot the field had when the store was created, for server rendering and hydration. */
  getServerSnapshot(path: Path): FieldSnapshot<unknown, E, N>;

  /** Calls `listener` after any write that changes the form snapshot. Returns the function that unsubscribes. */
  subscribeForm(listener: () => void): () => void;
  /** Returns the form snapshot. It returns the identical object until a member changes. */
  getFormSnapshot(): FormSnapshot<I, R, N>;
  /** Returns the form snapshot the store started with. */
  getServerFormSnapshot(): FormSnapshot<I, R, N>;
  /**
   * Returns the current form snapshot. The same as `getFormSnapshot`, named
   * for reads in event handlers and effects. Never call it during render.
   */
  peek(): FormSnapshot<I, R, N>;

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
   * field with that dotted name. A name `pathOf` doesn't resolve sends its
   * errors to the root, after the `form` errors, and development warns
   * (`field:unknown`). User errors don't block submit and clear when the
   * field's value is next written as a user edit.
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
   * submit's `signal` aborts. With `values`, the form takes those values and
   * they become the baseline, as for a record the server just sent.
   */
  reset(options?: FormResetOptions<V>): void;
  /**
   * Adds a validator at stable path `path`. The returned function removes it
   * and the errors it set.
   */
  registerValidator(path: Path, validator: ValidatorInput<unknown, E>): () => void;

  /**
   * Returns the handle at stable path `path`, the same object `at` and
   * `item` return. Returns `undefined` when the path names no field: a
   * segment goes into a leaf, names an item key the array never had, or
   * names a key its object doesn't have while nothing subscribes to or
   * validates a field there. Fields under a missing object count, since the
   * value can't say which keys it would have.
   */
  fieldAt(path: Path): NamedAnyFieldHandle<E, N> | undefined;
  /**
   * Returns the stable path of the field with dotted name `name`, such as
   * `rows.0.title`, by the rule `fieldAt` uses. Returns `undefined` when no
   * field has that name, so a caller can send server errors for a renamed
   * field somewhere visible before `setErrors` puts them on the root.
   */
  pathOf(name: string): Path | undefined;
  /**
   * Returns the first enabled field in `invalidFields(store)`, for the adapter to focus
   * after an invalid submit, or for an `onSubmit` that just put a server's
   * errors on the form with `setErrors`. Read-only fields count. Disabled
   * ones don't: `disabledInvalid` lists those. Returns `undefined` when there
   * is none. A read for event handlers and effects, not render.
   */
  firstInvalid(): NamedAnyFieldHandle<E, N> | undefined;
  /**
   * Returns the disabled fields in `invalidFields(store)`. Their validation errors still
   * block submit, but `firstInvalid` skips them, so after an invalid submit
   * the adapter can show these at form level. A field counts as disabled when
   * it or a field above it is. Returns an empty list when there is none. A
   * read for event handlers and effects, not render.
   */
  disabledInvalid(): readonly InvalidField<E>[];
  /**
   * The API of each installed hook plugin that has one, by plugin name:
   * `store.plugins.history.undo()`. A store from a definition types it
   * from the plugin list.
   */
  readonly plugins: A;
}

/**
 * A store of any value, intent and result type, and any plugins. Handles
 * and validators use it so a store of any form fits. It has no `changes`,
 * since a store without `dirty()` fits too. `N` names plugins the store
 * must have, for its snapshots' members: `AnyFormStore<E, "dirty">` has
 * `dirty` on them.
 */
// `any` here lets FormStore<V, E, I, R, A> of every V, I, R and A fit, whatever their variance.
// It is the interface, not the `FormStore` alias, so TypeScript compares by variance. A store of any plugins fits one of none.
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyFormStore<E = FormError, N extends string = never> = FormStoreBase<any, E, any, any, any, N>;
