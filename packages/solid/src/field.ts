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
import type { Accessor } from "solid-js";
import { notImplemented } from "./not-implemented.js";

/**
 * What the adapter needs from a handle: its id, its stable path, and a store
 * to subscribe to. Every core handle fits. The value and error types come
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
 * A field's snapshot as reactive reads. It has every member of
 * `FieldSnapshot`, each a getter over one signal that mirrors the store's
 * snapshot for this field. Reading `field.value` in JSX or a memo tracks
 * that signal, so the read re-runs when this field's snapshot changes and
 * at no other time. Don't destructure it: a destructured member is read once.
 */
export type FieldState<V, E> = FieldSnapshot<V, E>;

/**
 * Reads a field's snapshot reactively. Call it in a component body or
 * another owner. It subscribes to the store at once and unsubscribes when
 * the owner is disposed.
 *
 * Called with no owner it subscribes to nothing, and its getters return the
 * current snapshot without tracking. On the server, and in the browser while
 * hydrating, it reads the store's server snapshot, so the markup matches.
 */
export type CreateField = <H extends HandleLike>(handle: H) => FieldState<ValueOf<H>, ErrorOf<H>>;

/** See `CreateField`. Not implemented yet: it throws. */
export const createField: CreateField = notImplemented("createField");

/** What `createFormState` needs from a store. Every `FormStore` fits. */
export type FormStateSource<I, R> = Pick<
  FormStore<unknown, never, I, R>,
  "subscribeForm" | "getFormSnapshot" | "getServerFormSnapshot"
>;

/**
 * The form snapshot as reactive reads: every member of `FormSnapshot`, each
 * a getter over one signal that mirrors the store's form snapshot.
 */
export type FormState<I, R> = FormSnapshot<I, R>;

/**
 * Reads the form snapshot reactively. Takes the store, or anything with a
 * `store`, such as a handle. Ownership, server and hydration rules are the
 * ones `createField` follows.
 */
export type CreateFormState = <I, R>(
  form: FormStateSource<I, R> | { readonly store: FormStateSource<I, R> },
) => FormState<I, R>;

/** See `CreateFormState`. Not implemented yet: it throws. */
export const createFormState: CreateFormState = notImplemented("createFormState");

/** What `createItems` needs from an array handle. Array handles and loose handles fit. */
export interface ArrayHandleLike extends HandleLike {
  /** Returns the item handle for a stable key. */
  item(key: string): unknown;
}

/**
 * Returns the item handles of an array field, in their current order, as an
 * accessor. It is a memo over the field's `keys`, so it changes only when an
 * item is added, removed or moved, never on an edit inside an item. Each key
 * maps to the same handle object every time, so `<For each={items()}>`
 * keeps a row's DOM through inserts, removes and moves.
 */
export type CreateItems = <H extends ArrayHandleLike>(handle: H) => Accessor<readonly ReturnType<H["item"]>[]>;

/** See `CreateItems`. Not implemented yet: it throws. */
export const createItems: CreateItems = notImplemented("createItems");

/** What `createValidator` needs from a handle. */
export interface ValidatorHandleLike extends HandleLike {
  /** Adds a validator and returns the function that removes it. */
  registerValidator(validator: never): () => void;
}

/**
 * Adds a validator to a field for the life of the current owner, and removes
 * it and its errors when the owner is disposed. It registers once, with the
 * validator it was given. To make a validator conditional, create it under
 * `<Show>`, or pass `undefined`, `null` or `false` to add none.
 */
export type CreateValidator = <H extends ValidatorHandleLike>(
  handle: H,
  validator: ValidatorInput<ValueOf<H>, ErrorOf<H>> | undefined | null | false,
) => void;

/** See `CreateValidator`. Not implemented yet: it throws. */
export const createValidator: CreateValidator = notImplemented("createValidator");
