import type {
  ErrorOf,
  FieldSnapshot,
  FormSnapshot,
  FormStore,
  HandleTypes,
  Path,
  ValidatorInput,
  ValueOf,
} from "@lunarhue/forms-core";
import { notImplemented } from "./not-implemented.js";

/**
 * What the hooks need from a handle: its id, its stable path, and a store to
 * subscribe to. Every core handle fits. Hooks read the value and error types
 * from `~types`, so a handle passed as a prop needs no annotation.
 */
export interface HandleLike {
  /** The handle's id. */
  readonly id: string;
  /** The handle's stable path. */
  readonly path: Path;
  /** The store to subscribe to. */
  readonly store: Pick<FormStore<unknown, unknown>, "subscribe" | "getSnapshot" | "getServerSnapshot">;
  /** Type information only. */
  readonly "~types"?: HandleTypes<unknown, unknown>;
}

/** The snapshot type of a handle type. */
export type SnapshotOf<H> = FieldSnapshot<ValueOf<H>, ErrorOf<H>>;

/**
 * Compares two selected values. Return true to keep the previous one and
 * skip the re-render. Defaults to `Object.is`.
 */
export type IsEqual<T> = (previous: T, next: T) => boolean;

/**
 * Reads a field's snapshot and re-renders when it changes. It reads through
 * `useSyncExternalStore` on the handle's store, with the store's server
 * snapshot for server rendering and hydration.
 *
 * With `select`, the component gets what `select` returns and re-renders only
 * when that changes by `isEqual`. `select` may be an inline function. It must
 * return the same value, by `isEqual`, for the same snapshot.
 */
export interface UseField {
  <H extends HandleLike>(handle: H): SnapshotOf<H>;
  <H extends HandleLike, T>(handle: H, select: (snapshot: SnapshotOf<H>) => T, isEqual?: IsEqual<T>): T;
}

/** See `UseField`. Not implemented yet: it throws. */
export const useField: UseField = notImplemented("useField");

/** What `useFormState` needs from a store. Every `FormStore` fits. */
export type FormStateSource<I, R> = Pick<
  FormStore<unknown, never, I, R>,
  "subscribeForm" | "getFormSnapshot" | "getServerFormSnapshot"
>;

/**
 * Reads the form snapshot and re-renders when it changes. Takes the value
 * `useForm` returned, or any store, such as `handle.store`. With `select` it
 * narrows the same way `useField` does.
 */
export interface UseFormState {
  <I, R>(form: FormStateSource<I, R> | { readonly store: FormStateSource<I, R> }): FormSnapshot<I, R>;
  <I, R, T>(
    form: FormStateSource<I, R> | { readonly store: FormStateSource<I, R> },
    select: (snapshot: FormSnapshot<I, R>) => T,
    isEqual?: IsEqual<T>,
  ): T;
}

/** See `UseFormState`. Not implemented yet: it throws. */
export const useFormState: UseFormState = notImplemented("useFormState");

/** What `useItems` needs from an array handle. Array handles and loose handles fit. */
export interface ArrayHandleLike extends HandleLike {
  /** Returns the item handle for a stable key. */
  item(key: string): unknown;
}

/**
 * Returns the item handles of an array field, in their current order. The
 * component re-renders only when the item keys change: an item added,
 * removed or moved. An edit inside an item does not re-render it. The list
 * keeps its identity until the keys change, so it is safe as a dependency.
 */
export type UseItems = <H extends ArrayHandleLike>(handle: H) => readonly ReturnType<H["item"]>[];

/** See `UseItems`. Not implemented yet: it throws. */
export const useItems: UseItems = notImplemented("useItems");

/** What `useValidator` needs from a handle. */
export interface ValidatorHandleLike extends HandleLike {
  /** Adds a validator and returns the function that removes it. */
  registerValidator(validator: never): () => void;
}

/**
 * Adds a validator to a field while the component is mounted, and removes it
 * and its errors on unmount. Pass `undefined`, `null` or `false` to add none,
 * so a validator can be conditional without breaking the rules of hooks.
 *
 * A validator function or options object may be inline. The adapter
 * registers once and calls the latest function on each run. It registers
 * again when the handle changes, when a schema is a different object, when
 * a function becomes a schema or the other way round, or when `debounce`,
 * `on` or `recheckOnSubmit` change.
 */
export type UseValidator = <H extends ValidatorHandleLike>(
  handle: H,
  validator: ValidatorInput<ValueOf<H>, ErrorOf<H>> | undefined | null | false,
) => void;

/** See `UseValidator`. Not implemented yet: it throws. */
export const useValidator: UseValidator = notImplemented("useValidator");
