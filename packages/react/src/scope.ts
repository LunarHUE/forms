import type {
  FieldHandle,
  FieldSnapshot,
  FormError,
  HandleTypes,
  ItemHandle,
  ItemOf,
  Path,
  ValueOf,
  ErrorOf,
} from "@lunarhue/forms-core";
import type { JSXElementConstructor, ReactElement, ReactNode } from "react";
import type { ArrayHandleLike, HandleLike, IsEqual, SnapshotOf } from "./field.js";
import type { InputOptionsFor, InputPropsFor, NoOptionsArgs, TextInputProps } from "./input.js";
import type { ArrayPath, FieldPath, ValueAt } from "./path.js";

/** `inputProps` on a field: `useInputProps` with the handle filled in. */
export interface InputPropsMethod<V> {
  <const O extends InputOptionsFor<V>>(options: O): InputPropsFor<O>;
  (...options: NoOptionsArgs<V>): TextInputProps;
}

/** The handle members a field object carries as commands. The rest are on `handle`. */
type CommandsOf<V, E> = Omit<
  FieldHandle<V, E>,
  "id" | "path" | "store" | "~types" | "~children" | "peek" | "registerValidator"
>;

/**
 * One field as a single object: the members of its snapshot (`value`,
 * `errors`, `shownErrors`, `touched`, `dirty`, `name` and the rest), the
 * commands of its handle kind (`setValue`, `setErrors`, `handleBlur`,
 * `reset`, `push` on arrays, `at` on objects and so on, all bound), the
 * handle itself, `inputProps` and `errorId`. A new object comes with each
 * new snapshot. This is the `field` prop of a registered field component.
 */
export type FieldApi<V, E = FormError> = FieldSnapshot<V, E> &
  CommandsOf<V, E> & {
    /** The handle, for passing on and for `at` and `item` when the field has children. */
    readonly handle: FieldHandle<V, E>;
    /** The handle's id. */
    readonly id: string;
    /** The handle's stable path. */
    readonly path: Path;
    /** `errorId(handle)`, for the element that shows the errors. */
    readonly errorId: string;
    /** Input props for this field, checked by kind as `useInputProps` checks them. */
    readonly inputProps: InputPropsMethod<V>;
    /** Type information only. It lets `ValueOf` and `ErrorOf` read a field object. */
    readonly "~types"?: HandleTypes<V, E>;
  };

/** The field object for a handle type. */
export type FieldApiOf<H> = FieldApi<ValueOf<H>, ErrorOf<H>>;

/**
 * Props of a bound `Field` naming its field by path. Without `select`,
 * `children` gets the field object and re-renders on every change to the
 * field. With `select`, it gets what `select` returns from the snapshot and
 * re-renders only when that changes by `isEqual`.
 */
export interface FieldByName<V, E, N extends string, T> {
  /** A dotted path relative to the scope, through objects only. */
  readonly name: N;
  readonly handle?: never;
  readonly select?: (snapshot: FieldSnapshot<ValueAt<V, N>, E>) => T;
  readonly isEqual?: IsEqual<T>;
  readonly children: (field: T, handle: FieldHandle<ValueAt<V, N>, E>) => ReactNode;
}

/** Props of a bound `Field` given a handle. The rest as `FieldByName`. */
export interface FieldByHandle<H extends HandleLike, T> {
  readonly handle: H;
  readonly name?: never;
  readonly select?: (snapshot: SnapshotOf<H>) => T;
  readonly isEqual?: IsEqual<T>;
  readonly children: (field: T, handle: H) => ReactNode;
}

/** `scope.Field`: renders one field with exactly one of `name` or `handle`. */
export interface BoundField<V, E> {
  <N extends FieldPath<V>, T = FieldApi<ValueAt<V, N>, E>>(props: FieldByName<V, E, N, T>): ReactElement;
  <H extends HandleLike, T = FieldApiOf<H>>(props: FieldByHandle<H, T>): ReactElement;
}

/** Props of a bound `Items` naming its array by path. */
export interface ItemsByName<V, E, N extends string> {
  /** A dotted path, relative to the scope, to an array field. */
  readonly name: N;
  readonly handle?: never;
  /** Renders one item. Each result is keyed by the item's stable key. */
  readonly children: (item: ItemHandle<ItemOf<ValueAt<V, N>>, E>, index: number) => ReactNode;
}

/** Props of a bound `Items` given an array handle. */
export interface ItemsByHandle<H extends ArrayHandleLike> {
  readonly handle: H;
  readonly name?: never;
  /** Renders one item. Each result is keyed by the item's stable key. */
  readonly children: (item: ReturnType<H["item"]>, index: number) => ReactNode;
}

/**
 * `scope.Items`: renders one child per item of an array field, keyed by the
 * item's stable key. It re-renders when items are added, removed or moved,
 * not when a value inside an item changes.
 */
export interface BoundItems<V, E> {
  <N extends ArrayPath<V>>(props: ItemsByName<V, E, N>): ReactElement;
  <H extends ArrayHandleLike>(props: ItemsByHandle<H>): ReactElement;
}

/** The field components of a `createForms` call that registers none. */
// An empty map is what "no components" means here, so the empty object type is intended.
// oxlint-disable-next-line typescript/no-generated-empty-object-type
export type NoFields = Record<never, never>;

/** Any component an app can register as a field component. */
export type FieldComponentType = JSXElementConstructor<never>;

/** The app's field components by the name they get on every scope. */
export type FieldComponentMap = Readonly<Record<string, FieldComponentType>>;

/** The props of a registered component. */
export type PropsOf<C extends FieldComponentType> = C extends JSXElementConstructor<infer P> ? P : never;

/** The `field` prop type of a registered component. */
export type FieldPropOf<C extends FieldComponentType> = PropsOf<C> extends { readonly field: infer A } ? A : never;

/** A registered component's own props: everything but `field`. */
export type OwnPropsOf<C extends FieldComponentType> = Omit<PropsOf<C>, "field">;

/**
 * The names relative to a scope of value `V` whose field fits a component
 * whose field value type is `T`. A field fits when its handle type is
 * assignable to `FieldHandle<T, E>`, the rule core's handles follow: leaves
 * must match exactly, objects may have more keys than `T` asks for.
 */
export type NameFitting<V, E, T> =
  FieldPath<V> extends infer P
    ? P extends string
      ? [FieldHandle<ValueAt<V, P>, E>] extends [FieldHandle<T, E>]
        ? P
        : never
      : never
    : never;

/**
 * A registered component bound to a scope. It takes the component's own
 * props and exactly one of `name` or `handle`, then renders the component
 * with `field` filled in. Only fields that fit the component's field type
 * are accepted, see `NameFitting`.
 */
export interface BoundFieldComponent<V, E, T, P> {
  (props: P & { readonly name: NameFitting<V, E, T>; readonly handle?: never }): ReactElement;
  (props: P & { readonly handle: FieldHandle<T, E>; readonly name?: never }): ReactElement;
}

/**
 * The registered components as bound on a scope. A component whose field
 * error type doesn't accept the form's error type is `never` there.
 */
export type BoundFieldComponents<V, E, F extends FieldComponentMap> = {
  readonly [K in keyof F]: [E] extends [ErrorOf<FieldPropOf<F[K]>>]
    ? BoundFieldComponent<V, E, ValueOf<FieldPropOf<F[K]>>, OwnPropsOf<F[K]>>
    : never;
};

/** The members every scope has besides the registered components. */
export interface ScopeMembers<V, E> {
  /** The scope's object handle. `name` paths start here. */
  readonly root: FieldHandle<V, E>;
  /** Renders one field of this scope. */
  readonly Field: BoundField<V, E>;
  /** Renders the items of an array field of this scope. */
  readonly Items: BoundItems<V, E>;
}

/**
 * The bound components rooted at one object handle: `Field`, `Items` and
 * every registered field component, with `name` paths relative to `root`.
 * The form is the scope at its root plus the submit members.
 */
export type Scope<V, E = FormError, F extends FieldComponentMap = NoFields> = ScopeMembers<V, E> &
  BoundFieldComponents<V, E, F>;

/** Options for a schema fieldset's `useScope`. */
export interface FieldsetScopeOptions {
  /**
   * False skips registering the fieldset's schema on the handle. By default
   * the schema is a validator on the handle while the component is mounted.
   */
  readonly validate?: boolean;
}

/**
 * A reusable shape for a part of a form, made by `forms.fieldset<V>()`. It
 * is a token, not a component: the app writes an ordinary component that
 * takes a `HandleOf<typeof token>` prop and calls `useScope` in its body.
 */
export interface Fieldset<V, E = FormError, F extends FieldComponentMap = NoFields> {
  /** Type information only. Read it with `HandleOf`. */
  readonly "~types"?: HandleTypes<V, E>;
  /**
   * Returns the scope of `handle`, as `forms.scope` does. A hook, so the
   * schema form below can register its validator.
   */
  useScope(handle: FieldHandle<V, E>): Scope<V, E, F>;
}

/** A fieldset made from a schema by `forms.fieldset(schema)`. */
export interface SchemaFieldset<V, E = FormError, F extends FieldComponentMap = NoFields> extends Fieldset<V, E, F> {
  /**
   * Returns the scope of `handle`, and registers the schema as a validator
   * on it while the component is mounted, through the same path as
   * `useValidator`. Pass `{ validate: false }` to skip that.
   */
  useScope(handle: FieldHandle<V, E>, options?: FieldsetScopeOptions): Scope<V, E, F>;
}

/**
 * The handle type a fieldset component takes as a prop. A handle fits when
 * it is assignable to it, the rule core's handles follow: the same leaves,
 * and objects with at least the keys the shape has. So a handle of a wider
 * object, an item handle, or a handle from another form of the same
 * `createForms` fits, and a handle with a leaf of another type does not.
 */
export type HandleOf<T> = FieldHandle<ValueOf<T>, ErrorOf<T>>;
