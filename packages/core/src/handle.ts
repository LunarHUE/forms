import type { FormError, Many } from "./errors.js";
import type { Path, PathSegment } from "./path.js";
import type { FieldSnapshot } from "./snapshot.js";
import type { AnyFormStore } from "./store.js";
import type { ValidatorInput } from "./validator.js";
import type { ChildValue, DeepReadonly, IsLiteralUnion, ItemOf, KeysOf, LeafValue } from "./value.js";

/**
 * Options every write command takes. Every write counts as a user edit
 * unless it opts out: a user edit marks the field edited, clears the user
 * errors of the fields it writes, and runs input validation.
 */
export interface WriteOptions {
  /** Pass false for a write that is not a user edit, such as loading data. Defaults to true. */
  readonly edited?: boolean;
}

/** Options for an object handle's `setValue` when it merges. */
export interface MergeOptions extends WriteOptions {
  /** False or missing: merge the patch into the current value. */
  readonly replace?: false;
}

/** Options for an object handle's `setValue` when it replaces. */
export interface ReplaceOptions extends WriteOptions {
  /** True: replace the whole value, dropping keys the new value lacks. */
  readonly replace: true;
}

/** Options for `reset`. */
export interface ResetOptions {
  /**
   * `"baseline"` (the default) goes back to the current baseline, which
   * rebase can move. `"initial"` goes back to the value the store started with.
   */
  readonly to?: "baseline" | "initial";
}

/** The phantom that carries a handle's value, error and plugin types. It never exists at runtime. */
export interface HandleTypes<V, E, N extends string = never> {
  /** The handle's value type. */
  readonly value: V;
  /** The form's error type. */
  readonly error: E;
  /**
   * The names of the form's plugins, as a parameter so a handle of a form
   * with more plugins fits where one with fewer is asked for.
   */
  readonly plugins: (name: N) => void;
}

/**
 * What every handle has. A handle is a stable object that carries a field's
 * identity and its commands. It never returns state, except `peek()`.
 * Framework adapters read state through the store's `subscribe` and
 * `getSnapshot` with the handle's `path`.
 *
 * `N` is the names of the form's plugins, which decide what its snapshots
 * have: `dirty` needs `dirty()`. It defaults to none, and a handle of a form
 * with more plugins fits where one with fewer is asked for.
 */
export interface HandleBase<V, E = FormError, N extends string = never> {
  /**
   * The form id and the encoded stable path. Stable for the life of the
   * field, so it works as a DOM id and a list key.
   */
  readonly id: string;
  /** The stable path: property names, and an item's stable key in place of its index. */
  readonly path: Path;
  /** The store the handle belongs to, so an adapter can subscribe given only a handle. */
  readonly store: AnyFormStore<E>;
  /** Type information only. Read it with `ValueOf`, `ErrorOf` and `PluginsOf`. It is always undefined at runtime. */
  readonly "~types"?: HandleTypes<V, E, N>;
  /**
   * Returns the field's current snapshot. This is the only member that
   * returns state. Call it in event handlers and effects, never during
   * render. Rendering reads go through the adapter.
   */
  peek(): FieldSnapshot<V, E, N>;
  /**
   * Marks the field touched and runs blur validation. Pass it to the input's
   * blur event. To set only the touched flag, without validation, use
   * `setTouched`.
   */
  handleBlur(): void;
  /**
   * Sets this field's touched flag, or clears it with false. It sets only
   * this field's own flag: fields above and below keep theirs, as with
   * `handleBlur`. Use `reset` to clear a whole subtree. It runs no validator
   * and arms none. With `show: "touched"` the field's validation errors
   * show while the flag is set.
   */
  setTouched(touched?: boolean): void;
  /**
   * Replaces this field's user errors. User errors show in `errors` after
   * validation errors, don't block submit, and clear when the field's value
   * is next written as a user edit.
   */
  setErrors(errors: Many<E>): void;
  /**
   * Runs every validator at and below this field now, skipping debounce and
   * timing. Resolves true when the subtree has no validation error.
   */
  validate(): Promise<boolean>;
  /**
   * Adds a validator to this field. The returned function removes it and the
   * errors it set.
   */
  // Typed through `this` so the parameter doesn't make handles invariant in V.
  registerValidator<H extends HandleBase<unknown, E, N>>(this: H, validator: ValidatorInput<ValueOf<H>, E>): () => void;
  /** Puts this subtree's value back, and clears its touched, edited and error state. */
  reset(options?: ResetOptions): void;
  /** Disables or enables this field and everything below it. */
  setDisabled(on: boolean): void;
  /** Makes this field and everything below it read-only, or undoes that. */
  setReadOnly(on: boolean): void;
}

/** The handle for a leaf value: a primitive, `Date`, `Blob`, `File`, `Map`, `Set` or function. */
export interface LeafHandle<V, E = FormError, N extends string = never> extends HandleBase<V, E, N> {
  /**
   * Writes a new value, or the result of calling an updater with the current
   * value. For a function-typed value pass an updater that returns the function.
   */
  // A property, not a method, so strictFunctionTypes keeps leaf handles invariant in V.
  readonly setValue: (value: NoInfer<V | DeepReadonly<V>> | ((previous: V) => V), options?: WriteOptions) => void;
}

/** The patch an object handle merges: any subset of one member's keys. */
export type Patch<V> = V extends object ? Partial<V> : never;

/** The handle for a plain object value. */
export interface ObjectHandle<V, E = FormError, N extends string = never> extends HandleBase<V, E, N> {
  // No write changes its argument, so every write on every handle kind
  // also takes the readonly value a snapshot holds. The NoInfer keeps write
  // parameters out of inference. Without it, a function that infers V from
  // an item handle gets the value and its readonly copy as V.
  /**
   * Merges `patch` into the current value, one level deep. Merging into a
   * missing object starts from an empty one. With `replace: true` it
   * replaces the whole value instead.
   */
  // A property, not a method, so strictFunctionTypes keeps object handles
  // invariant in V: a handle of a wider object doesn't fit one asking for a
  // narrower shape, which could then drop the keys it doesn't know.
  readonly setValue: {
    /** Replaces the whole value. */
    (value: NoInfer<V | DeepReadonly<V>>, options: ReplaceOptions): void;
    /**
     * Merges `patch` into the current value, one level deep. Merging into a
     * missing object starts from an empty one.
     */
    (patch: NoInfer<Patch<V | DeepReadonly<V>>>, options?: MergeOptions): void;
  };
  /**
   * Returns the handle of the child at `key`. It reads no state: it returns
   * the same handle object for the same key on every call, whether or not
   * the value has that key now. For a union of objects any member's key is
   * accepted, and the child's value type includes `undefined` for members
   * that lack the key.
   */
  // `keyof V` takes the keys a generic V's constraint names, which KeysOf,
  // a deferred conditional type for a generic V, doesn't.
  at<K extends KeysOf<V> | (keyof V & (string | number))>(key: K): FieldHandle<ChildValue<V, K>, E, N>;
  /**
   * Type information only, always undefined at runtime. It makes TypeScript
   * compare child handles when one object handle is assigned to another, so
   * a child leaf of the wrong type is caught.
   */
  // TypeScript compares two instantiations of a generic interface by the
  // measured variance of V when it can. Measured covariance would let
  // `{ a: string }` pass as `{ a: string | undefined }`. The `-?` in
  // ChildHandles makes V's variance unmeasurable, so TypeScript compares
  // object handles member by member, and this member brings the children in.
  readonly "~children"?: ChildHandles<V, E, N>;
}

/** The child handles of an object value, by key. `ObjectHandle.at` returns one of them. */
// Keep the `-?`. See the comment on ObjectHandle's "~children".
export type ChildHandles<V, E = FormError, N extends string = never> = {
  readonly [K in KeysOf<V>]-?: FieldHandle<ChildValue<V, K>, E, N>;
};

/**
 * The item and options `push` and `insert` take on an array with items of
 * type `I`. The item is required when `I` is a union of literals without
 * `null` or `undefined`, such as the options a checkbox group picks. No
 * option is the empty one, so the adapter's item value is `undefined`,
 * which `I` doesn't allow. The item may be readonly, as a snapshot's
 * values are.
 */
export type ItemArgs<I> =
  IsLiteralUnion<I> extends true
    ? [Extract<I, null | undefined>] extends [never]
      ? [item: NoInfer<I | DeepReadonly<I>>, options?: WriteOptions]
      : [item?: NoInfer<I | DeepReadonly<I>>, options?: WriteOptions]
    : [item?: NoInfer<I | DeepReadonly<I>>, options?: WriteOptions];

/**
 * The commands that change an array's length or order. `T` is the `this`
 * they take: anything when the form has `arrays()`, else a type that names
 * it, so a call without it is a type error that says to add `arrays()`.
 */
export interface ArrayCommands<V, T> {
  /**
   * Adds an item at the end. With no item it uses the schema adapter's item
   * value, or `undefined` when there is no adapter. An array of a union of
   * literals has no empty item, so it needs the item. See `ItemArgs`.
   */
  // `push` and `insert` are properties, not methods, so strictFunctionTypes
  // keeps array handles invariant in V. See `ArrayHandle.setValue`.
  readonly push: (this: T, ...args: ItemArgs<ItemOf<V>>) => void;
  /** Adds an item before `index`. With no item it behaves as `push` does. */
  readonly insert: (this: T, index: number, ...args: ItemArgs<ItemOf<V>>) => void;
  /**
   * Removes the item at `index`. Its handle keeps returning its last
   * snapshot, so a component that is still unmounting can read it. The store
   * keeps the removed item's state, last snapshots and handles until the
   * store itself is freed.
   */
  remove(this: T, index: number, options?: WriteOptions): void;
  /** Moves the item at `from` to `to`. The item keeps its key and its handle. */
  move(this: T, from: number, to: number, options?: WriteOptions): void;
}

/**
 * The handle for an array value. Items are addressed by stable key, not
 * index. `push`, `insert`, `remove` and `move` need `arrays()` among the
 * form's plugins `N`.
 */
export interface ArrayHandle<V, E = FormError, N extends string = never> extends HandleBase<V, E, N>,
    // Written out rather than aliased, so the type error shows the text.
    // No conditional type, so a handle of a form with more plugins still
    // fits where one with fewer is asked for. See `Gate`.
    ArrayCommands<
      V,
      void | Omit<{ readonly "Add arrays() to this form's plugins": never }, { readonly [K in "arrays"]: "Add arrays() to this form's plugins" }["arrays" & N]>
    > {
  /** Replaces the whole array. A readonly array, such as a snapshot's value, works too. */
  // A property, not a method, so strictFunctionTypes keeps array handles
  // invariant in V: a handle of wider items doesn't fit one asking for
  // narrower items, which could then write items missing keys.
  readonly setValue: (value: NoInfer<V | DeepReadonly<V>>, options?: WriteOptions) => void;
  /**
   * Returns the handle of the item with stable key `key`. It reads no state:
   * it returns the same handle object for the same key on every call. The
   * current keys are in the snapshot's `keys`. A removed item's key still
   * returns its handle, which keeps its last snapshot and ignores commands,
   * for the life of the store.
   */
  item(key: string): ItemHandle<ItemOf<V>, E, N>;
}

/** An array item's handle: the handle for its value plus its stable key. The handle follows the item when it moves. */
export type ItemHandle<V, E = FormError, N extends string = never> = FieldHandle<V, E, N> & {
  /** The item's stable key. It is also the last segment of `path`. */
  readonly key: string;
};

/**
 * A handle with every member loosely typed, for code that walks fields
 * without knowing their types. Structure members exist on every handle at
 * runtime but only do something on fields of that shape.
 */
export interface AnyFieldHandle<E = FormError, N extends string = never>
  extends HandleBase<unknown, E, N>,
    LooseArrayCommands<
      void | Omit<{ readonly "Add arrays() to this form's plugins": never }, { readonly [K in "arrays"]: "Add arrays() to this form's plugins" }["arrays" & N]>
    > {
  /** The stable key, on array items. */
  readonly key?: string;
  /** Writes a value. On an object it merges unless `replace` is true. */
  setValue(value: unknown, options?: WriteOptions & { readonly replace?: boolean }): void;
  /** The child handle at `key`, as on `ObjectHandle`. */
  at(key: PathSegment): AnyFieldHandle<E, N>;
  /** The item handle for stable key `key`, as on `ArrayHandle`. */
  item(key: string): AnyFieldHandle<E, N> & { readonly key: string };
}

/** `ArrayCommands` loosely typed, for `AnyFieldHandle`. */
export interface LooseArrayCommands<T> {
  /** As on `ArrayHandle`. Needs `arrays()`. */
  push(this: T, item?: unknown, options?: WriteOptions): void;
  /** As on `ArrayHandle`. Needs `arrays()`. */
  insert(this: T, index: number, item?: unknown, options?: WriteOptions): void;
  /** As on `ArrayHandle`. Needs `arrays()`. */
  remove(this: T, index: number, options?: WriteOptions): void;
  /** As on `ArrayHandle`. Needs `arrays()`. */
  move(this: T, from: number, to: number, options?: WriteOptions): void;
}

/**
 * The handle for a value of type `V`. Arrays get `ArrayHandle`, plain
 * objects get `ObjectHandle`, everything else gets `LeafHandle`. `null` and
 * `undefined` in `V` don't change the choice: `Address | undefined` gets an
 * object handle whose children read `undefined` while it is missing. A
 * union that mixes leaves with objects or arrays gets a leaf handle.
 * `unknown` and `any` get `AnyFieldHandle`.
 *
 * In a component generic in `T extends Tag`, the handle of `T["name"]`
 * reads as the handle of `Tag["name"]`, so it fits a field component for a
 * string. See `HandleFor`.
 */
export type FieldHandle<V, E = FormError, N extends string = never> = HandleFor<V, V, E, N>;

/**
 * Picks the handle for `All`, one member `V` of it at a time.
 *
 * It distributes over `V` for generic values. TypeScript reads a deferred
 * conditional type that distributes over its check type through that
 * type's constraint, so for `T["name"]` with `T extends { name: string }`
 * the branch for `string` applies. Each branch takes its value type from
 * `All`, the whole value, so a union still gets one handle for all of it.
 * A leaf takes `V | All`, which is `All` for a concrete union and the
 * constraint for a generic value. A branch for a member that doesn't decide
 * the handle kind gives `never`.
 */
export type HandleFor<V, All, E, N extends string> = V extends null | undefined
  ? [KindsOf<All>] extends [never]
    ? LeafHandle<All, E, N>
    : never
  : 0 extends 1 & V
    ? AnyFieldHandle<E, N>
    : V extends LeafValue
      ? LeafHandle<V | All, E, N>
      : V extends readonly unknown[]
        ? [KindsOf<All>] extends ["array"]
          ? ArrayHandle<All, E, N>
          : never
        : // Not `unknown extends V`: for a constraint TypeScript keeps a true
          // branch whose extends type its check type might hold, which would
          // add AnyFieldHandle to every object handle.
          V extends object
          ? // "leaf" is checked against the kinds, not the other way, so a
            // generic `All` leaves both branches open and the deferred type
            // is assignable where `ObjectHandle<All>` is.
            "leaf" extends KindsOf<All>
            ? never
            : ObjectHandle<All, E, N>
          : AnyFieldHandle<E, N>;

/** The handle kinds the members of `V` ask for, ignoring `null` and `undefined`. */
type KindsOf<V> = V extends null | undefined ? never : V extends LeafValue ? "leaf" : V extends readonly unknown[] ? "array" : "object";

/** The value type of a handle type. */
export type ValueOf<H> = H extends { readonly "~types"?: HandleTypes<infer V, unknown> } ? V : never;

/** The error type of a handle type. */
export type ErrorOf<H> = H extends { readonly "~types"?: HandleTypes<unknown, infer E> } ? E : never;

/** The names of the plugins of a handle type's form. */
export type PluginsOf<H> = H extends { readonly "~types"?: HandleTypes<unknown, unknown, infer N extends string> } ? N : never;

/** The value of the discriminant key `K` that selects one member of `V`. */
type Discriminant<V, K extends PropertyKey> = Extract<ChildValue<V, K>, string | number | boolean>;

/** The members of `V` whose key `K` holds `L`. */
export type Narrow<V, K extends PropertyKey, L> = Extract<NonNullable<V>, { readonly [P in K]: L }>;

/**
 * Narrows an object handle over a union to one member. It takes the handle,
 * that handle's snapshot, a discriminant key and a literal. It returns the
 * same handle object typed as the matching member when the snapshot's value
 * holds `value` at `key`, and `undefined` otherwise. It reads no state
 * itself, so pass the snapshot the adapter gave you.
 */
export type Branch = <V, E, K extends KeysOf<V>, const L extends Discriminant<V, K>, N extends string = never>(
  handle: ObjectHandle<V, E, N>,
  snapshot: FieldSnapshot<NoInfer<V>, NoInfer<E>>,
  key: K,
  value: L,
) => FieldHandle<Narrow<V, K, L>, E, N> | undefined;
