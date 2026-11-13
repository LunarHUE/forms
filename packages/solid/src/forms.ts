import type {
  AnyFieldHandle,
  DefinedValue,
  Definition,
  DisabledInvalid,
  ErrorOf,
  FieldHandle,
  FormDefinition,
  FormError,
  FormsConfig,
  FormStore,
  IntentArgs,
  ItemHandle,
  ItemOf,
  ObjectHandle,
  SchemaAdapter,
  SchemaValue,
  StandardSchemaV1,
  Submission,
  ValidatorInput,
  ValueOf,
} from "@lunarhue/forms-core";
import type { Accessor, Element as SolidElement } from "solid-js";
import type { ArrayHandleLike, FieldApi, FieldTypes, FormState, HandleLike } from "./field.js";
import { notImplemented } from "./not-implemented.js";
import type { ArrayPath, FieldPath, ValueAt } from "./paths.js";

/**
 * What a failed submit leaves to focus. The adapter builds it from core's
 * `firstInvalid()` and `disabledInvalid()` after a submit ends invalid.
 */
export interface FocusTarget<E = FormError> {
  /** Core's `firstInvalid()`: the first enabled field with a validation error, or undefined. */
  readonly field: AnyFieldHandle<E> | undefined;
  /**
   * Core's `disabledInvalid()`: the disabled fields whose errors blocked the
   * submit. Their inputs can't take focus, so `createDisabledErrors` lists
   * them for showing at form level.
   */
  readonly disabled: readonly DisabledInvalid<E>[];
  /**
   * The element the default focuses: the element registered for `field`.
   * When `field` is undefined or has no element, it is the `<form>` element
   * from `formProps.ref`. Undefined only when no form element is mounted
   * either.
   */
  readonly element: HTMLElement | undefined;
}

/**
 * What happens after a submit ends invalid. `true`, the default, scrolls
 * `FocusTarget.element` into view and focuses it. So the first enabled
 * invalid field gets focus, and when only disabled fields are invalid the
 * form element gets it. `false` does nothing. A function replaces the
 * default and is called after every invalid submit.
 */
export type FocusOnInvalid<E = FormError> = boolean | ((target: FocusTarget<E>) => void);

/** The props for the `<form>` element. None of them ever change. */
export interface FormElementProps {
  /** The store id. */
  readonly id: string;
  /** Turns off the browser's own validation, since the form validates itself. */
  readonly novalidate: true;
  /**
   * -1, so the adapter can focus the form after a submit that only disabled
   * fields blocked, without putting the form in the tab order.
   */
  readonly tabindex: -1;
  /** Calls `handleSubmit`. */
  readonly onSubmit: (event: Event) => void;
  /** Registers the form element as the focus fallback. */
  readonly ref: (element: HTMLFormElement) => void;
}

/** What `form.Form` passes to a function child: the form element props plus `submit`. */
export interface FormRenderProps<I = undefined, R = unknown> extends FormElementProps {
  /** The form's `submit`, for buttons that submit with an intent. */
  readonly submit: (...args: IntentArgs<I>) => Promise<Submission<I, R>>;
}

/**
 * Provides the form through context to everything below it. It renders no
 * element. A function child gets the form element props and `submit`, to
 * spread on the real `<form>`: `{({ submit, ...props }) => <form {...props}>}`.
 * Every member is fixed for the life of the form, so destructuring them
 * loses nothing. Plain children get the context only. The child runs once.
 */
export type FormComponent<I = undefined, R = unknown> = (props: {
  readonly children: ((props: FormRenderProps<I, R>) => SolidElement) | SolidElement;
}) => SolidElement;

/** Props `Field` takes besides `name` or `handle`. */
interface FieldPropsBase<V, E> {
  /** A validator to add while the `Field` is mounted, as `createValidator` adds it. Read once, at mount. */
  readonly validate?: ValidatorInput<V, E> | undefined;
  /** Renders the field. Runs once. */
  readonly children: (field: FieldApi<V, E>) => SolidElement;
}

/**
 * Renders one field of a scope with its `FieldApi`. Give exactly one of
 * `name`, a dotted path relative to the scope, or `handle`.
 */
export interface BoundField<V, E = FormError> {
  <P extends FieldPath<V>>(props: { readonly name: P; readonly handle?: never } & FieldPropsBase<ValueAt<V, P>, E>): SolidElement;
  <H extends HandleLike>(
    props: { readonly handle: H; readonly name?: never } & FieldPropsBase<ValueOf<H>, ErrorOf<H>>,
  ): SolidElement;
}

/** Props `Items` takes besides `name` or `handle`. */
interface ItemsPropsBase<Item> {
  /** Shown while the array has no items. */
  readonly fallback?: SolidElement;
  /**
   * Renders one item. Runs once per item key, so the row keeps its DOM when
   * items are added, removed or moved. `index` follows the item's position.
   */
  readonly children: (item: Item, index: Accessor<number>) => SolidElement;
}

/**
 * Renders an array field's items with `For`, keyed by core's stable item
 * keys. Give exactly one of `name`, which must name an array field, or
 * `handle`. `item` is the item handle: render its fields with
 * `<scope.Field handle={item.at("qty")}>`.
 */
export interface BoundItems<V, E = FormError> {
  <P extends ArrayPath<V>>(
    props: { readonly name: P; readonly handle?: never } & ItemsPropsBase<ItemHandle<ItemOf<ValueAt<V, P>>, E>>,
  ): SolidElement;
  <H extends ArrayHandleLike>(props: { readonly handle: H; readonly name?: never } & ItemsPropsBase<ReturnType<H["item"]>>): SolidElement;
}

/** Any Solid component. The constraint for registered field components. */
// `any` lets a component of any props fit. Each one is checked by `CheckedFields`.
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyComponent = (props: any) => SolidElement;

/** The field components an app registers, by the name they get on every scope. */
export type FieldComponents = Readonly<Record<string, AnyComponent>>;

/** No registered field components. */
// An object type with no keys is the point here: a form with no registered components gets no extra members.
// oxlint-disable-next-line typescript/no-generated-empty-object-type
export type NoFieldComponents = Readonly<Record<never, never>>;

/** The names a scope or form uses itself, which a registered component can't take. */
export type ReservedName =
  | "Field"
  | "Items"
  | "Form"
  | "store"
  | "root"
  | "id"
  | "state"
  | "formProps"
  | "submit"
  | "handleSubmit";

/** The props of a component. */
export type PropsOf<C> = C extends (props: infer P) => unknown ? P : never;

/** The `FieldApi` type a registered component's `field` prop asks for. */
type FieldPropOf<C> = PropsOf<C> extends { readonly field: infer A } ? A : never;

/** The value type a registered component's `field` prop asks for. */
export type FieldValueOf<C> = FieldPropOf<C> extends { readonly "~field"?: FieldTypes<infer V, unknown> } ? V : never;

/** The error type a registered component's `field` prop asks for. */
export type FieldErrorOf<C> = FieldPropOf<C> extends { readonly "~field"?: FieldTypes<unknown, infer E> } ? E : never;

/** A registered component's own props: all of them except `field`. */
export type OwnProps<C> = Omit<PropsOf<C>, "field">;

/**
 * True when a field of value `V` and error `E` fits a registered component.
 * The rule is core's handle assignability: the field's handle must be
 * assignable to the handle of the component's field type. A leaf handle is
 * invariant in its value, since the component both reads and writes it, so
 * a `FieldApi<number | undefined>` component takes a `number | undefined`
 * field (a schema number under `Draft`) but not a `number` one. An object
 * field may have more keys than the component's type names.
 */
export type FitsComponent<V, E, C> = [FieldHandle<V, E>] extends [FieldHandle<FieldValueOf<C>, FieldErrorOf<C>>]
  ? true
  : false;

/** The names in `V` whose fields fit registered component `C`. */
export type FitPath<V, E, C> = {
  [P in FieldPath<V>]: FitsComponent<ValueAt<V, P>, E, C> extends true ? P : never;
}[FieldPath<V>];

/**
 * A registered field component bound to a scope. It resolves the field by
 * `name` or `handle`, makes its `FieldApi`, and renders the app's component
 * with `field` filled in. The other props are the component's own. Only
 * fields that fit the component (see `FitsComponent`) are accepted.
 */
export interface BoundFieldComponent<V, E, C> {
  (props: { readonly name: FitPath<V, E, C>; readonly handle?: never } & OwnProps<C>): SolidElement;
  (
    props: { readonly handle: FieldHandle<FieldValueOf<C>, FieldErrorOf<C>>; readonly name?: never } & OwnProps<C>,
  ): SolidElement;
}

/** The registered components, bound to a scope of value `V`. */
export type BoundFieldComponents<V, E, F extends FieldComponents> = {
  readonly [K in keyof F]: BoundFieldComponent<V, E, F[K]>;
};

/** The members every scope has. */
export interface ScopeMembers<V, E> {
  /** The handle the scope is rooted at. Names are relative to it. */
  readonly root: FieldHandle<V, E>;
  /** Renders one field of the scope. */
  readonly Field: BoundField<V, E>;
  /** Renders the items of an array field of the scope. */
  readonly Items: BoundItems<V, E>;
}

/**
 * The bound components rooted at an object handle: `Field`, `Items` and
 * every registered field component, with names relative to `root`.
 */
export type Scope<V, E = FormError, F extends FieldComponents = NoFieldComponents> = ScopeMembers<V, E> &
  BoundFieldComponents<V, E, F>;

/** What a form has beyond its root scope. */
export interface FormMembers<V, E, I, R> {
  /** The core store. Every handle's `store` is this object. */
  readonly store: FormStore<V, E, I, R>;
  /** The store id. */
  readonly id: string;
  /**
   * The form snapshot as reactive reads, such as `form.state.submitting`. Its
   * getters read one signal that mirrors the form snapshot. It subscribes the
   * first time a getter is read inside a reactive owner, and unsubscribes
   * when the owner `createForm` ran in is disposed. A read outside any owner
   * returns the current form snapshot's member, tracks nothing, and doesn't
   * subscribe.
   */
  readonly state: FormState<I, R>;
  /** The props for the `<form>` element, the same ones `Form` passes to its child. */
  readonly formProps: FormElementProps;
  /**
   * Submits with an intent, as `store.submit` does, then applies
   * `focusOnInvalid` when the submit ends invalid. Bound, so it can be
   * passed on as it is.
   */
  readonly submit: (...args: IntentArgs<I>) => Promise<Submission<I, R>>;
  /**
   * As `store.handleSubmit`, then applies `focusOnInvalid` when the submit
   * ends invalid. Bound, like `submit`.
   */
  readonly handleSubmit: (event?: { preventDefault(): void }) => Promise<void>;
  /** Provides this form through context. See `FormComponent`. */
  readonly Form: FormComponent<I, R>;
}

/**
 * A form made in a component: the scope at its root plus the submit
 * members. Every member keeps its identity for the life of the form, and
 * the bound components are made once, in `createForm`. Everything on it
 * works with no `Form` above, when the form or a handle is passed as a prop.
 */
export type SolidForm<V, E = FormError, I = undefined, R = unknown, F extends FieldComponents = NoFieldComponents> = Scope<
  V,
  E,
  F
> &
  FormMembers<V, E, I, R>;

/**
 * A form with its value, error, intent and result types unknown, as the
 * generic `useFormContext` returns it. Enough for `submit`, `formProps`,
 * `state` and `store`.
 */
export type AnyForm = SolidForm<unknown, unknown, unknown>;

/** Per-form settings for `createForm`. */
export interface FormSettings<E = FormError> {
  /**
   * The store id, which prefixes every handle id and so every DOM id.
   * Defaults to `createUniqueId()`, which matches between server and client.
   */
  readonly id?: string;
  /** Overrides the `focusOnInvalid` given to `createForms`. */
  readonly focusOnInvalid?: FocusOnInvalid<E>;
}

/** The arguments `createForm` takes: the definition's options unless they are `void`, then per-form settings. */
export type CreateFormArgs<O, E> = [O] extends [void] ? [settings?: FormSettings<E>] : [options: O, settings?: FormSettings<E>];

/**
 * A form definition for Solid. It still has core's `createStore`, for tests
 * and code outside components.
 */
export interface SolidFormDefinition<
  V,
  E = FormError,
  I = undefined,
  R = unknown,
  O = void,
  F extends FieldComponents = NoFieldComponents,
> extends FormDefinition<V, E, I, R, O> {
  /** Makes the form. Call it in a component body: the form's subscriptions end with that owner. */
  createForm(...args: CreateFormArgs<O, E>): SolidForm<V, E, I, R, F>;
  /**
   * Returns the nearest form of this definition from a `form.Form` above,
   * even when another definition's `form.Form` is nearer. Throws when there
   * is none.
   */
  useFormContext(): SolidForm<V, E, I, R, F>;
}

/** Options for a fieldset's `scope`. */
export interface FieldsetScopeOptions {
  /** `false` skips registering the fieldset's schema as a validator on the handle. */
  readonly validate?: false;
}

/**
 * A reusable value shape, not tied to one form: a token with the shape type
 * and `scope`. An app's fieldset is an ordinary component that takes a
 * handle prop typed `HandleOf<typeof Shape>` and calls `Shape.scope` in its
 * body.
 */
export interface Fieldset<V, E = FormError, F extends FieldComponents = NoFieldComponents> {
  /** Type information only, always undefined at runtime. */
  readonly "~shape"?: FieldTypes<V, E>;
  /**
   * Returns the scope rooted at `handle`, as `forms.scope` does. Call it in
   * a component body. The handle is read once, as everything in a Solid
   * component body is: to move the fieldset to another handle, render it
   * again under `<Show when={handle} keyed>`.
   */
  scope(handle: FieldHandle<V, E>): Scope<V, E, F>;
}

/**
 * A fieldset made from a schema. Its `scope` also registers the schema as a
 * validator on the handle for the life of the current owner, as
 * `createValidator` does, unless `validate` is `false`.
 */
export interface SchemaFieldset<V, E = FormError, F extends FieldComponents = NoFieldComponents> {
  /** Type information only, always undefined at runtime. */
  readonly "~shape"?: FieldTypes<V, E>;
  /** Returns the scope rooted at `handle` and registers the schema on it. See `Fieldset.scope`. */
  scope(handle: FieldHandle<V, E>, options?: FieldsetScopeOptions): Scope<V, E, F>;
}

/**
 * The handle type a fieldset component takes as its prop. Any handle
 * assignable to it fits: an object with more keys does, while a leaf of a
 * different type, even a wider or narrower one, does not. This is core's
 * handle assignability.
 */
export type HandleOf<T> = T extends { readonly "~shape"?: FieldTypes<infer V, infer E> } ? FieldHandle<V, E> : never;

/** Defines a fieldset shape. */
export interface DefineFieldset<A extends readonly SchemaAdapter<never>[], E, F extends FieldComponents> {
  /** The shape from a type, with no schema: `forms.fieldset<Address>()`. */
  <V>(): Fieldset<V, E, F>;
  /**
   * The shape from a schema: the `Draft` of its input when a registered
   * adapter supports it, as `define` types it, and the input itself
   * otherwise.
   */
  <S extends StandardSchemaV1>(schema: S): SchemaFieldset<SchemaValue<S, A>, E, F>;
}

/**
 * `F` when every registered component has a `field` prop of a `FieldApi`
 * type and none takes a reserved name. A bad entry becomes `never`.
 */
export type CheckedFields<F> = {
  readonly [K in keyof F]: K extends ReservedName ? never : [FieldPropOf<F[K]>] extends [never] ? never : F[K];
};

/** Settings for `createForms`: core's settings plus the adapter's. */
export interface FormsOptions<A extends readonly SchemaAdapter<never>[] = [], E = FormError, F extends FieldComponents = NoFieldComponents>
  extends FormsConfig<A, E> {
  /** What happens after a submit ends invalid. Defaults to `true`. Each form can override it. */
  readonly focusOnInvalid?: FocusOnInvalid<E>;
  /**
   * The app's field components, by the name they get on every scope. Each
   * takes a `field` prop of a `FieldApi` type plus props of its own. A name
   * a scope or form uses itself (see `ReservedName`) is a type error.
   */
  readonly fields?: F & CheckedFields<F>;
}

/**
 * What `createForms` returns. `define` takes what core's `define` takes,
 * with the same inference: `V` from the schema or `defaultValues`, `E` from
 * `mapError`, `I` from the annotation on `onSubmit`'s `ctx.intent`, `R` from
 * what `onSubmit` returns.
 */
export interface SolidForms<A extends readonly SchemaAdapter<never>[] = [], E = FormError, F extends FieldComponents = NoFieldComponents> {
  /** Defines a form. See core's `FormsCore.define`. */
  define<V = never, S extends StandardSchemaV1 = never, O = void, I = undefined, R = unknown>(
    config: Definition<V, S, A, E, I, R> | ((options: O) => Definition<V, S, A, E, I, R>),
  ): SolidFormDefinition<DefinedValue<V, S, A>, E, I, R, O, F>;
  /**
   * Returns the scope rooted at an object handle of any form made from
   * these settings, with the registered components. It returns the same
   * scope object, and so the same component functions, every time for the
   * same handle. It needs no context. Call it in a component body.
   */
  scope<S>(handle: ObjectHandle<S, E>): Scope<S, E, F>;
  /** Defines a fieldset shape. See `DefineFieldset`. */
  readonly fieldset: DefineFieldset<A, E, F>;
}

/**
 * The adapter's entry point. It wraps `createFormsCore`, takes the same
 * config plus the adapter's settings, and holds no state. Call it once at
 * module scope.
 */
export type CreateForms = <
  const A extends readonly SchemaAdapter<never>[] = [],
  E = FormError,
  F extends FieldComponents = NoFieldComponents,
>(
  options?: FormsOptions<A, E, F>,
) => SolidForms<A, E, F>;

/** See `CreateForms`. Not implemented yet: it throws. */
export const createForms: CreateForms = notImplemented("createForms");

/**
 * Returns the form from the nearest `form.Form` above, of any definition,
 * with its types unknown. Use it in reusable parts such as a submit button.
 * Throws when there is none.
 */
export type UseFormContext = () => AnyForm;

/** See `UseFormContext`. Not implemented yet: it throws. */
export const useFormContext: UseFormContext = notImplemented("useFormContext");

/**
 * Returns the disabled fields with validation errors, as of the latest
 * submit that ended invalid, for showing at form level. The list is empty
 * until a submit ends invalid, and again once a later submit starts. While
 * the latest submit stays invalid it follows the form snapshot, so fixing or
 * enabling a field takes it off the list. Call it in a component body.
 */
export type CreateDisabledErrors = <V, E, I, R>(
  form: FormStore<V, E, I, R> | { readonly store: FormStore<V, E, I, R> },
) => Accessor<readonly DisabledInvalid<E>[]>;

/** See `CreateDisabledErrors`. Not implemented yet: it throws. */
export const createDisabledErrors: CreateDisabledErrors = notImplemented("createDisabledErrors");
