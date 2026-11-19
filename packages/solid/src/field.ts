import type {
  Draft,
  ErrorOf,
  FieldHandle,
  FieldSnapshot,
  FormError,
  FormSnapshot,
  FormStore,
  HandleTypes,
  Path,
  PluginsOf,
  ValidatorInput,
  ValueOf,
} from "@lunarhue/forms-core";
import type { Accessor } from "solid-js";
import { createFieldApi } from "./field-api.js";
import type { FieldPieces } from "./pieces.js";
import { createItemList } from "./items.js";
import { addValidator } from "./validator.js";

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

/** The snapshot type of a handle type. It has `dirty` when the handle's form has `dirty()`. */
export type SnapshotOf<H> = FieldSnapshot<ValueOf<H>, ErrorOf<H>, PluginsOf<H>>;

/**
 * The phantom that carries a field's value, error and plugin types on a
 * field object. It never exists at runtime.
 */
export interface FieldTypes<V, E, Installed extends string = never> {
  /** The field's value type. */
  readonly value: V;
  /** The form's error type. */
  readonly error: E;
  /** The names of the form's plugins, as a parameter, so a field of a form with more plugins fits where fewer are named. */
  readonly plugins?: (name: Installed) => void;
}

/** The handle members a field object leaves out: state reads, the store, and type phantoms. */
type HiddenHandleMembers = "peek" | "store" | "registerValidator" | "~types" | "~children";

/** The commands of the handle for a value of type `V`. */
export type FieldCommands<V, E = FormError, Installed extends string = never> = Omit<
  FieldHandle<V, E, Installed>,
  HiddenHandleMembers
>;

/**
 * One field whose value type is exactly `V`, as one object. `Field`,
 * `createField` and the free functions give this type. It has:
 * - every member of the field's snapshot (`value`, `errors`, `shownErrors`,
 *   `touched`, `dirty`, `name` and the rest), each a getter over one signal
 *   that mirrors the store's snapshot for this field. Reading `field.value`
 *   in JSX tracks that signal, so the read re-runs when this field's
 *   snapshot changes and at no other time;
 * - the handle's commands, which depend on its kind: `setValue`,
 *   `handleBlur`, `setTouched`, `setErrors`, `validate`, `reset`,
 *   `setDisabled`, `setReadOnly`, and `at` on objects or `push`, `insert`,
 *   `remove`, `move` and `item` on arrays;
 * - `handle` itself and `errorId`;
 * - the pieces that bind an element by hand: `text`, `setText`,
 *   `setNumberText`, `ref`, and `handleBlur`, which also drops typed number
 *   text. `inputProps(field)` builds a DOM prop spread from them.
 *
 * Don't destructure the snapshot members or `text`: a destructured member is
 * read once. The commands, `handle`, `errorId` and the other pieces never
 * change, so destructuring those is fine.
 *
 * `Installed` is the names of the form's plugins. Members a plugin adds,
 * such as `dirty` from `dirty()`, are there only when it is among them.
 */
export type ExactFieldApi<V, E = FormError, Installed extends string = never> = FieldSnapshot<V, E, Installed> &
  FieldCommands<V, E, Installed> & {
    /** The field's handle. */
    readonly handle: FieldHandle<V, E, Installed>;
    /** The id for the element that renders this field's errors. See `errorId`. */
    readonly errorId: string;
    /** See `FieldPieces.text`. Reactive. */
    readonly text: string;
    /** See `FieldPieces.setText`. */
    readonly setText: FieldPieces["setText"];
    /** See `FieldPieces.setNumberText`. `empty` is what empty text writes. */
    readonly setNumberText: (text: string, empty?: V) => void;
    /** See `FieldPieces.ref`. */
    readonly ref: FieldPieces["ref"];
    /** Type information only, always undefined at runtime. */
    readonly "~field"?: FieldTypes<V, E, Installed>;
  };

/**
 * The `field` prop of a registered field component: the field object for a
 * `Draft<T>` value, so an app writes `FieldApi<number>` for a number field.
 * `FieldApi<number>` has `value: number | undefined` and its `setValue`
 * takes `number | undefined`, which is what a schema form holds before the
 * user fills the field in. `FieldApi<string>` is the field for a string,
 * since `Draft<string>` is `string`.
 *
 * A field fits the component when its value type is `Draft<T>`, which is
 * every field of a form built from a schema. A plain form's field typed
 * exactly `T` fits too. That side is loose: the component may write
 * `undefined` into a field typed `number`, and the type checker won't catch
 * it.
 *
 * For a select, radio group or checkbox group, write `FieldApi<Choice>` or
 * `FieldApi<Choice[]>` and use `Choice` for the option values in the other
 * props. The component then fits any field of string options, and each use
 * checks the options against the named field. See `Choice`.
 *
 * A component that reads a plugin's members names the plugin in
 * `Installed`: `FieldApi<string, FormError, "dirty">` has `dirty`, and fits
 * only fields of forms with `dirty()`.
 */
export type FieldApi<T, E = FormError, Installed extends string = never> = ExactFieldApi<Draft<T>, E, Installed> & {
  /** Type information only: the `T` the component was written for. */
  readonly "~fits"?: FieldTypes<T, E, Installed>;
};

/**
 * Makes the field object for a handle. Call it in a component body or
 * another owner. It subscribes to the store at once and unsubscribes when
 * the owner is disposed.
 *
 * Called with no owner it subscribes to nothing, and its getters return the
 * current snapshot without tracking. On the server, and in the browser while
 * hydrating, it reads the store's server snapshot, so the markup matches.
 */
export const createField: <H extends HandleLike>(handle: H) => ExactFieldApi<ValueOf<H>, ErrorOf<H>, PluginsOf<H>> =
  // The runtime object has the members `ExactFieldApi` names for the handle's kind.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  createFieldApi as never;

/**
 * The form snapshot as reactive reads: every member of `FormSnapshot`, each
 * a getter over one signal that mirrors the store's form snapshot.
 * `Installed` is the names of the form's plugins: `dirty` needs `dirty()`.
 */
export type FormState<I, R, Installed extends string = never> = FormSnapshot<I, R, Installed>;

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
export const createItems: <H extends ArrayHandleLike>(handle: H) => Accessor<readonly ReturnType<H["item"]>[]> =
  // Each entry is what `handle.item` returns, which the type names.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  createItemList as never;

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
export const createValidator: <H extends ValidatorHandleLike>(
  handle: H,
  validator: ValidatorInput<ValueOf<H>, ErrorOf<H>> | undefined | null | false,
) => void = addValidator;
