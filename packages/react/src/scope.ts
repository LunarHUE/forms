import type {
  ChoiceHandle,
  ChoiceValue,
  Draft,
  ErrorOf,
  FieldHandle,
  FieldSnapshot,
  FormError,
  HandleTypes,
  HasChoice,
  ItemHandle,
  ItemOf,
  Path,
  ValidatorInput,
  ValueOf,
  WithChoice,
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
 * One field as a single object, for a field whose value type is exactly
 * `V`: the members of its snapshot (`value`, `errors`, `shownErrors`,
 * `touched`, `dirty`, `name` and the rest), the commands of its handle kind
 * (`setValue`, `setErrors`, `setTouched`, `handleBlur`, `reset`, `push` on
 * arrays, `at` on objects and so on, all bound), the handle itself,
 * `inputProps` and `errorId`. A new object comes with each new snapshot.
 * `Field` passes this to its children. Registered components take `FieldApi`.
 */
export type ExactFieldApi<V, E = FormError> = FieldSnapshot<V, E> &
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

/**
 * The `field` prop of a registered field component: the field object for a
 * `Draft<T>` value. So `FieldApi<number>` has `value: number | undefined`
 * and its `setValue` takes `number | undefined`, which is what a schema form
 * holds before the user fills the field in. `FieldApi<string>` is the field
 * object for a string, since `Draft<string>` is `string`.
 *
 * A field fits the component when its value type is `Draft<T>`, which is
 * every field of a form built from a schema. A field typed exactly `T`, as a
 * plain form's `number` field is, fits too. That side is loose: the
 * component may write `undefined` into a field typed `number`, and the type
 * checker won't catch it.
 *
 * For a select, radio group or checkbox group, write `FieldApi<Choice>` or
 * `FieldApi<Choice[]>` and use `Choice` for the option values in the other
 * props. The component then fits any field of string options, and each use
 * checks the options against the named field. See `Choice`.
 */
export type FieldApi<T, E = FormError> = ExactFieldApi<Draft<T>, E> & {
  /** Type information only: the `T` the component was written for. */
  readonly "~fits"?: { readonly value: T };
};

/** The field object for a handle type, with the handle's exact value type. */
export type FieldApiOf<H> = ExactFieldApi<ValueOf<H>, ErrorOf<H>>;

/**
 * The `validate` prop of `Field` and of the bound registered components. It
 * takes what `useValidator` takes, typed from the field: a validator
 * function, a Standard Schema, or either one with options such as
 * `debounce`. `undefined`, `null` or `false` add none.
 *
 * The validator runs only while the component is mounted. On unmount it is
 * removed along with the errors it set. A field that isn't rendered, such as
 * one on a wizard step that isn't showing, isn't validated by its prop, so a
 * submit can pass without it. Rules that must always hold belong in the
 * definition. A definition validator and a prop validator on the same field
 * both run, and each adds its own errors.
 *
 * An inline function is fine: the adapter registers once and calls the
 * latest function on each run, as `useValidator` does.
 */
export type ValidateProp<V, E> = ValidatorInput<V, E> | undefined | null | false;


/**
 * Props of a bound `Field` naming its field by path.
 *
 * Without `select`, `children` gets the field object and re-renders on every
 * change to the field. Use it this way to render an input.
 *
 * With `select`, `children` gets `(selected, handle)` and re-renders only
 * when `selected` changes by `isEqual`. Use it this way to read one thing
 * about a field, such as an error count or a derived label. The handle still
 * carries every command (`setValue`, `handleBlur`, `reset`, `push` and the
 * rest), and `errorId(handle)` gives the error id. There is no `inputProps`
 * with `select`, and there can't be: input props need the value, the
 * disabled and read-only flags and the shown errors, so a render that has
 * them must re-render on all of them.
 */
export interface FieldByName<V, E, N extends string, T> {
  /** A dotted path relative to the scope, through objects only. */
  readonly name: N;
  readonly handle?: never;
  /**
   * Picks what `children` gets instead of the field object. With it,
   * `children` has no `inputProps`. See `FieldByName`.
   */
  readonly select?: (snapshot: FieldSnapshot<ValueAt<V, N>, E>) => T;
  /** Compares two results of `select`. Defaults to `Object.is`. */
  readonly isEqual?: IsEqual<T>;
  /** A validator added while this `Field` is mounted. See `ValidateProp` for the mounted-only rule. */
  readonly validate?: ValidateProp<ValueAt<V, N>, E>;
  readonly children: (field: T, handle: FieldHandle<ValueAt<V, N>, E>) => ReactNode;
}

/** Props of a bound `Field` given a handle. The rest, `select` included, as `FieldByName`. */
export interface FieldByHandle<H extends HandleLike, T> {
  readonly handle: H;
  readonly name?: never;
  /**
   * Picks what `children` gets instead of the field object. With it,
   * `children` has no `inputProps`. See `FieldByName`.
   */
  readonly select?: (snapshot: SnapshotOf<H>) => T;
  /** Compares two results of `select`. Defaults to `Object.is`. */
  readonly isEqual?: IsEqual<T>;
  /** A validator added while this `Field` is mounted. See `ValidateProp` for the mounted-only rule. */
  readonly validate?: ValidateProp<ValueOf<H>, ErrorOf<H>>;
  readonly children: (field: T, handle: H) => ReactNode;
}

/**
 * `scope.Field`: renders one field with exactly one of `name` or `handle`.
 * TypeScript reports the error of the last signature only, so the `name`
 * signature, the common one, comes last.
 */
export interface BoundField<V, E> {
  <H extends HandleLike, T = FieldApiOf<H>>(props: FieldByHandle<H, T>): ReactElement;
  <N extends FieldPath<V>, T = ExactFieldApi<ValueAt<V, N>, E>>(props: FieldByName<V, E, N, T>): ReactElement;
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
 * The value types a registered component's field accepts, each wrapped as
 * `{ value: T }` so a union of them stays apart. A `FieldApi<T>` accepts
 * `Draft<T>` and `T`. A field object typed another way, such as
 * `FieldApiOf<H>`, accepts its value type only.
 */
export type AcceptedValues<A> = "~fits" extends keyof A
  ? A extends { readonly "~fits"?: { readonly value: infer T } }
    ? { readonly value: Draft<T> } | { readonly value: T }
    : never
  : { readonly value: ValueOf<A> };

/** The handles a component that accepts `A` (see `AcceptedValues`) takes. */
export type AcceptedHandle<A, E> = A extends { readonly value: infer T } ? FieldHandle<T, E> : never;

/**
 * The names relative to a scope of value `V` whose field fits a component
 * that accepts `A`, see `AcceptedValues`. A field fits when its handle type
 * is assignable to one of the accepted handle types, the rule core's handles
 * follow: leaves must match exactly, objects may have more keys than asked for.
 */
export type NameFitting<V, E, A> =
  FieldPath<V> extends infer P
    ? P extends string
      ? [FieldHandle<ValueAt<V, P>, E>] extends [AcceptedHandle<A, E>]
        ? P
        : never
      : never
    : never;

/**
 * A registered component bound to a scope. It takes the component's own
 * props, exactly one of `name` or `handle`, and an optional `validate`, then
 * renders the component with `field` filled in. `name`, `handle` and
 * `validate` are the bound component's own and never reach the registered
 * one. Only fields that fit the component are accepted, see
 * `AcceptedValues` and `FieldApi`. The `name` signature comes last, as on
 * `BoundField`.
 */
export interface BoundFieldComponent<V, E, A, O> {
  <H extends AcceptedHandle<A, E>>(
    props: O & {
      readonly handle: H;
      readonly name?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidateProp<ValueOf<H>, ErrorOf<H>>;
    },
  ): ReactElement;
  <N extends NameFitting<V, E, A>>(
    props: O & {
      readonly name: N;
      readonly handle?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidateProp<ValueAt<V, N>, E>;
    },
  ): ReactElement;
}

/**
 * The `T` of a registered component's `FieldApi<T>` when `T` is written
 * with `Choice`, else `never`.
 */
export type ChoiceFieldOf<A> = "~fits" extends keyof A
  ? A extends { readonly "~fits"?: { readonly value: infer T } }
    ? HasChoice<T> extends true
      ? T
      : never
    : never
  : never;

/**
 * The names relative to a scope of value `V` whose field fits a component
 * with a `FieldApi<T>` field, `T` written with `Choice`. See `ChoiceHandle`.
 */
export type NameFittingChoice<V, E, T> =
  FieldPath<V> extends infer P
    ? P extends string
      ? [FieldHandle<ValueAt<V, P>, E>] extends [ChoiceHandle<T, ValueAt<V, P>, E>]
        ? P
        : never
      : never
    : never;

/**
 * A registered component with a `FieldApi<T>` field, `T` written with
 * `Choice`, bound to a scope. Each use reads the option type from the named
 * field and puts it in place of `Choice` in the component's own props `P`.
 * TypeScript reports the error of the last signature only, so the `name`
 * signature comes last: a wrong name lists the names that fit, and a wrong
 * option lists the field's options. A handle that doesn't fit is reported
 * against that signature too, as not assignable to `never`. `validate`
 * works as on `BoundFieldComponent`.
 */
export interface BoundChoiceComponent<V, E, T, O> {
  <H extends HandleLike>(
    props: WithChoice<O, ChoiceValue<T, ValueOf<H>>> & {
      readonly handle: H & ChoiceHandle<T, ValueOf<H>, E>;
      readonly name?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidateProp<ValueOf<H>, ErrorOf<H>>;
    },
  ): ReactElement;
  <N extends NameFittingChoice<V, E, T>>(
    props: WithChoice<O, ChoiceValue<T, ValueAt<V, N>>> & {
      readonly name: N;
      readonly handle?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidateProp<ValueAt<V, N>, E>;
    },
  ): ReactElement;
}

/**
 * The registered components as bound on a scope. A component whose field
 * error type doesn't accept the form's error type is `never` there. A
 * component whose `FieldApi` is written with `Choice` is bound as
 * `BoundChoiceComponent`, every other one as `BoundFieldComponent`.
 *
 * Known hole: a component typed for a narrower error type still fits a form
 * whose error type extends it, and its `setErrors` then takes the narrower
 * type. So it can set errors that lack the form's extra members.
 */
export type BoundFieldComponents<V, E, F extends FieldComponentMap> = {
  readonly [K in keyof F]: [E] extends [ErrorOf<FieldPropOf<F[K]>>]
    ? [ChoiceFieldOf<FieldPropOf<F[K]>>] extends [never]
      ? BoundFieldComponent<V, E, AcceptedValues<FieldPropOf<F[K]>>, OwnPropsOf<F[K]>>
      : BoundChoiceComponent<V, E, ChoiceFieldOf<FieldPropOf<F[K]>>, OwnPropsOf<F[K]>>
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

/**
 * A reusable shape for a part of a form, made by `forms.fieldset(schema)` or
 * `forms.fieldset<V>()`. It is for type safety only: it registers no
 * validator, since the form's own schema validates. It is a token, not a
 * component: the app writes an ordinary component that takes a
 * `HandleOf<typeof token>` prop and calls `scope` in its body.
 */
export interface Fieldset<V, E = FormError, F extends FieldComponentMap = NoFields> {
  /** Type information only. Read it with `HandleOf`. */
  readonly "~types"?: HandleTypes<V, E>;
  /**
   * Returns the scope of `handle`, the same object `forms.scope` returns,
   * typed to the shape. A cached lookup, not a hook.
   */
  scope(handle: FieldHandle<V, E>): Scope<V, E, F>;
}

/**
 * The handle type a fieldset component takes as a prop. A handle fits when
 * it is assignable to it, the rule core's handles follow: the same leaves,
 * and objects with at least the keys the shape has. So a handle of a wider
 * object, an item handle, or a handle from another form of the same
 * `createForms` fits, and a handle with a leaf of another type does not.
 */
export type HandleOf<T> = FieldHandle<ValueOf<T>, ErrorOf<T>>;
