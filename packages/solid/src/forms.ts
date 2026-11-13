import type {
  AnyFieldHandle,
  ChoiceHandle,
  ChoiceValue,
  Combined,
  DefineConfig,
  DefinedValue,
  DisabledInvalid,
  Draft,
  ErrorOf,
  FieldHandle,
  FormDefinition,
  FormError,
  FormsConfig,
  FormStore,
  HasChoice,
  IfValidation,
  IntentArgs,
  ItemHandle,
  ItemOf,
  ObjectHandle,
  PluginApis,
  Plugins,
  PluginsFor,
  SchemaValue,
  StandardSchemaV1,
  Submission,
  ValidatorInput,
  ValueOf,
  WithChoice,
} from "@lunarhue/forms-core";
import type { Accessor, Element as SolidElement } from "solid-js";
import { createDisabledErrorList } from "./disabled-errors.js";
import type { ArrayHandleLike, ExactFieldApi, FieldTypes, FormState, HandleLike } from "./field.js";
import { createFormRuntime, createFormsRuntime, useAnyForm } from "./forms-runtime.js";
import type { ArrayPath, FieldPath, ValueAt } from "./path.js";

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

/**
 * Provides the form through context to everything below it. It renders no
 * element. `T` is the form that owns it. A function child gets the form
 * element props and the form: `{(formProps, form) => <form {...formProps}>}`.
 * Spread the first on the real `<form>` as it is. Every member is fixed for
 * the life of the form, so destructuring them loses nothing. Plain children
 * get the context only. The child runs once.
 */
export type FormComponent<T> = (props: {
  readonly children: ((formProps: FormElementProps, form: T) => SolidElement) | SolidElement;
}) => SolidElement;

/**
 * The `validate` prop of `Field` and of the bound registered components. It
 * takes what `createValidator` takes, typed from the field: a validator
 * function, a Standard Schema, or either one with options such as
 * `debounce`. `undefined`, `null` or `false` add none.
 *
 * The validator runs only while the component is mounted. When the
 * component's owner is disposed it is removed along with the errors it set.
 * A field that isn't rendered, such as one on a wizard step that isn't
 * showing, isn't validated by its prop, so a submit can pass without it.
 * Rules that must always hold belong in the definition. A definition
 * validator and a prop validator on the same field both run, and each adds
 * its own errors.
 *
 * The component registers once, at mount, with the kind of validator and
 * the options it finds then. When the prop is reactive and later gives
 * another function, each run calls the function the prop gives when the run
 * starts, without registering again. A schema is read at mount only.
 */
export type ValidateProp<V, E> = ValidatorInput<V, E> | undefined | null | false;

/**
 * `ValidateProp` on a form with plugins `P`: as it is when they bring the
 * validation runner. When they don't, a validator is a type error that says
 * what to install.
 */
export type ValidatePropFor<P extends Plugins, V, E> = IfValidation<P, ValidateProp<V, E>>;

/**
 * Props `Field` takes besides `name` or `handle`.
 *
 * Solid's `Field` has no `select`. Each member of the field object is its
 * own reactive read, so JSX that reads `field.errors.length` re-runs when the
 * errors change and at no other time. Read the members you need: render an
 * input with `field.inputProps`, or read one thing about a field, such as an
 * error count or a derived label, from that one member.
 */
interface FieldPropsBase<V, E, P extends Plugins> {
  /** A validator added while this `Field` is mounted. See `ValidateProp` for the mounted-only rule. */
  readonly validate?: ValidatePropFor<P, V, E>;
  /** Renders the field. Runs once. */
  readonly children: (field: ExactFieldApi<V, E>) => SolidElement;
}

/**
 * Renders one field of a scope with its `ExactFieldApi`. Give exactly one of
 * `name`, a dotted path relative to the scope, or `handle`. See
 * `FieldPropsBase` for reading one thing about a field. `P` is the form's
 * plugins. TypeScript reports the error of the last signature only, so the
 * `name` signature, the common one, comes last: a `validate` prop on a form
 * without the validation runner is reported against it alone.
 */
export interface BoundField<V, E = FormError, P extends Plugins = []> {
  <H extends HandleLike>(
    props: { readonly handle: H; readonly name?: never } & FieldPropsBase<ValueOf<H>, ErrorOf<H>, P>,
  ): SolidElement;
  <N extends FieldPath<V>>(props: { readonly name: N; readonly handle?: never } & FieldPropsBase<ValueAt<V, N>, E, P>): SolidElement;
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
  | "handleSubmit"
  | "plugins";

/**
 * The props a bound component takes for itself, which a registered component
 * can't declare: `validate`, see `ValidateProp`. The bound component keeps it
 * and never passes it on.
 */
export type ReservedProp = "validate";

/** The props of a component. */
export type PropsOf<C> = C extends (props: infer P) => unknown ? P : never;

/** The field object type a registered component's `field` prop asks for. */
type FieldPropOf<C> = PropsOf<C> extends { readonly field: infer A } ? A : never;

/** True when a registered component's `field` prop is a `FieldApi`, which fits `Draft<T>` and `T`. */
type TakesDraft<C> = "~fits" extends keyof FieldPropOf<C> ? true : false;

/**
 * The value type a registered component's field is written for: `T` of a
 * `FieldApi<T>`, or `V` of an `ExactFieldApi<V>`.
 */
export type FieldValueOf<C> =
  TakesDraft<C> extends true
    ? FieldPropOf<C> extends { readonly "~fits"?: FieldTypes<infer T, unknown> }
      ? T
      : never
    : FieldPropOf<C> extends { readonly "~field"?: FieldTypes<infer V, unknown> }
      ? V
      : never;

/** The error type a registered component's `field` prop asks for. */
export type FieldErrorOf<C> = FieldPropOf<C> extends { readonly "~field"?: FieldTypes<unknown, infer E> } ? E : never;

/**
 * The handles a registered component takes. A `FieldApi<T>` component takes
 * a handle of `Draft<T>` or of `T`. An `ExactFieldApi<V>` component takes a
 * handle of `V` only.
 */
export type ComponentHandle<C> =
  TakesDraft<C> extends true
    ? FieldHandle<Draft<FieldValueOf<C>>, FieldErrorOf<C>> | FieldHandle<FieldValueOf<C>, FieldErrorOf<C>>
    : FieldHandle<FieldValueOf<C>, FieldErrorOf<C>>;

/** A registered component's own props: all of them except `field`. */
export type OwnProps<C> = Omit<PropsOf<C>, "field">;

/**
 * True when a field of value `V` and error `E` fits registered component
 * `C`. The rule is core's handle assignability: the field's handle must be
 * assignable to one of `ComponentHandle<C>`. Leaf handles are invariant in
 * their value, so a `FieldApi<number>` component takes a `number | undefined`
 * field, the `Draft<number>` a schema form holds, and a plain form's
 * `number` field (see `FieldApi` for why that side is loose), but not a
 * `string` one. An object field may have more keys than the component's
 * type names.
 */
export type FitsComponent<V, E, C> = [FieldHandle<V, E>] extends [ComponentHandle<C>] ? true : false;

/** The names in `V` whose fields fit registered component `C`. */
export type FitPath<V, E, C> = {
  [P in FieldPath<V>]: FitsComponent<ValueAt<V, P>, E, C> extends true ? P : never;
}[FieldPath<V>];

/**
 * A registered field component bound to a scope. It resolves the field by
 * `name` or `handle`, adds the `validate` prop's validator, makes its field
 * object, and renders the app's component with `field` filled in. The other
 * props are the component's own: `name`, `handle` and `validate` never reach
 * it. Only fields that fit the component (see `FitsComponent`) are
 * accepted. The field is resolved once, when the component mounts.
 *
 * The `name` signature comes last, as on `BoundField`.
 *
 * Known hole: a component typed for a narrower error type fits a form whose
 * error type extends it, and its `setErrors` then takes the narrower type.
 * So the component can set errors that lack the form's extra members.
 */
export interface BoundFieldComponent<V, E, C, P extends Plugins = []> {
  <H extends ComponentHandle<C>>(
    props: {
      readonly handle: H;
      readonly name?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidatePropFor<P, ValueOf<H>, ErrorOf<H>>;
    } & OwnProps<C>,
  ): SolidElement;
  <N extends FitPath<V, E, C>>(
    props: {
      readonly name: N;
      readonly handle?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidatePropFor<P, ValueAt<V, N>, E>;
    } & OwnProps<C>,
  ): SolidElement;
}

/**
 * The `T` of a registered component's `FieldApi<T>` when `T` is written
 * with `Choice`, else `never`.
 */
export type ChoiceFieldOf<C> =
  TakesDraft<C> extends true ? (HasChoice<FieldValueOf<C>> extends true ? FieldValueOf<C> : never) : never;

/**
 * The names in `V` whose fields fit registered component `C`, whose
 * `FieldApi` is written with `Choice`. See `ChoiceHandle`.
 */
export type ChoicePath<V, E, C> =
  FieldPath<V> extends infer P
    ? P extends string
      ? [FieldHandle<ValueAt<V, P>, E>] extends [ChoiceHandle<ChoiceFieldOf<C>, ValueAt<V, P>, FieldErrorOf<C>>]
        ? P
        : never
      : never
    : never;

/**
 * A registered component whose `FieldApi<T>` is written with `Choice`,
 * bound to a scope. Each use reads the option type from the named field and
 * puts it in place of `Choice` in the component's own props. TypeScript
 * reports the error of the last signature only, so the `name` signature
 * comes last: a wrong name lists the names that fit, and a wrong option
 * lists the field's options. A handle that doesn't fit is reported against
 * that signature too, as not assignable to `never`. `validate` works as on
 * `BoundFieldComponent`.
 */
export interface BoundChoiceComponent<V, E, C, P extends Plugins = []> {
  <H extends HandleLike>(
    props: WithChoice<OwnProps<C>, ChoiceValue<ChoiceFieldOf<C>, ValueOf<H>>> & {
      readonly handle: H & ChoiceHandle<ChoiceFieldOf<C>, ValueOf<H>, FieldErrorOf<C>>;
      readonly name?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidatePropFor<P, ValueOf<H>, ErrorOf<H>>;
    },
  ): SolidElement;
  <N extends ChoicePath<V, E, C>>(
    props: WithChoice<OwnProps<C>, ChoiceValue<ChoiceFieldOf<C>, ValueAt<V, N>>> & {
      readonly name: N;
      readonly handle?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidatePropFor<P, ValueAt<V, N>, E>;
    },
  ): SolidElement;
}

/**
 * The registered components, bound to a scope of value `V`. A component
 * whose `FieldApi` is written with `Choice` is bound as
 * `BoundChoiceComponent`, every other one as `BoundFieldComponent`.
 */
export type BoundFieldComponents<V, E, F extends FieldComponents, P extends Plugins = []> = {
  readonly [K in keyof F]: [ChoiceFieldOf<F[K]>] extends [never]
    ? BoundFieldComponent<V, E, F[K], P>
    : BoundChoiceComponent<V, E, F[K], P>;
};

/** The members every scope has. */
export interface ScopeMembers<V, E, P extends Plugins = []> {
  /** The handle the scope is rooted at. Names are relative to it. */
  readonly root: FieldHandle<V, E>;
  /** Renders one field of the scope. */
  readonly Field: BoundField<V, E, P>;
  /** Renders the items of an array field of the scope. */
  readonly Items: BoundItems<V, E>;
}

/**
 * The bound components rooted at an object handle: `Field`, `Items` and
 * every registered field component, with names relative to `root`. `P` is
 * the plugins of the `createForms` call, which decide whether the
 * `validate` prop is allowed.
 */
export type Scope<V, E = FormError, F extends FieldComponents = NoFieldComponents, P extends Plugins = []> = ScopeMembers<
  V,
  E,
  P
> &
  BoundFieldComponents<V, E, F, P>;

/** What a form has beyond its root scope. `P` is every plugin the form has. */
export interface FormMembers<V, E, I, R, F extends FieldComponents = NoFieldComponents, P extends Plugins = []> {
  /** The core store. Every handle's `store` is this object. */
  readonly store: FormStore<V, E, I, R, PluginApis<P>>;
  /**
   * The API of each installed plugin that has one, by plugin name, from the
   * shared list and the definition's: `form.plugins.history.undo()`. The
   * same object as `store.plugins`.
   */
  readonly plugins: PluginApis<P>;
  /** The store id. */
  readonly id: string;
  /**
   * The form snapshot as reactive reads, such as `form.state.submitting`. Its
   * getters read one signal that mirrors the form snapshot. It subscribes the
   * first time a getter is read inside a reactive owner, and unsubscribes
   * when the owner `createForm` ran in is disposed. A read outside any owner
   * returns the current form snapshot's member, tracks nothing, and doesn't
   * subscribe. There is no `form.State` as in React: reading
   * `form.state.submitting` in JSX already updates only that spot.
   */
  readonly state: FormState<I, R>;
  /** The props for the `<form>` element, the same object `Form` passes to its child first. */
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
  readonly Form: FormComponent<SolidForm<V, E, I, R, F, P>>;
}

/**
 * A form made in a component: the scope at its root plus the submit
 * members. Every member keeps its identity for the life of the form, and
 * the bound components are made once, in `createForm`. Everything on it
 * works with no `Form` above, when the form or a handle is passed as a prop.
 */
export type SolidForm<
  V,
  E = FormError,
  I = undefined,
  R = unknown,
  F extends FieldComponents = NoFieldComponents,
  P extends Plugins = [],
> = Scope<V, E, F, P> & FormMembers<V, E, I, R, F, P>;

/**
 * A form with its value, error, intent and result types unknown, as the
 * generic `useFormContext` returns it. Enough for `submit`, `formProps`,
 * `state` and `store`.
 */
export type AnyForm = SolidForm<unknown, unknown, unknown>;

/** Per-form settings for `createForm`. `V` is the form's value type and `X` its own plugins. */
export interface FormSettings<E = FormError, V = unknown, X extends Plugins = Plugins> {
  /**
   * The store id, which prefixes every handle id and so every DOM id.
   * Defaults to `createUniqueId()`, which matches between server and client.
   */
  readonly id?: string;
  /** Overrides the `focusOnInvalid` given to `createForms`. */
  readonly focusOnInvalid?: FocusOnInvalid<E>;
  /**
   * Plugins for this form only, such as `zustand(store)` from
   * `@lunarhue/forms-bind/zustand` with a store this component made. They
   * run after the shared plugins and the definition's. The list is read
   * once, when the form is made. A plugin that names a value type, as a
   * binding does, must name the form's.
   */
  readonly plugins?: X & PluginsFor<V>;
}

/**
 * The arguments `createForm` takes after the definition: its options unless
 * they are `void`, then per-form settings. `V` is the form's value type and
 * `X` its own plugins.
 */
export type CreateFormArgs<O, E, V = unknown, X extends Plugins = Plugins> = [O] extends [void]
  ? [settings?: FormSettings<E, V, X>]
  : [options: O, settings?: FormSettings<E, V, X>];

/**
 * A form definition for Solid: what `createForm` and `useFormContext` take.
 * It carries the schema, the validators and the registered field
 * components, and still has core's `createStore`, for tests and code
 * outside components.
 */
export interface SolidFormDefinition<
  V,
  E = FormError,
  I = undefined,
  R = unknown,
  O = void,
  F extends FieldComponents = NoFieldComponents,
  P extends Plugins = [],
> extends FormDefinition<V, E, I, R, O, P> {
  /** Type information only, always undefined at runtime: the form `createForm` makes from this definition. */
  readonly "~form"?: SolidForm<V, E, I, R, F, P>;
}

/** The form a definition makes: `FormOf<typeof Signup>`. */
export type FormOf<D> = D extends { readonly "~form"?: infer T } ? T : never;

/**
 * Makes the form. Call it in a component body: the form's subscriptions end
 * with that owner. `options` is required when the definition was made with
 * the function form of `define`, and absent otherwise.
 */
export type CreateForm = <V, E, I, R, O, F extends FieldComponents, P extends Plugins, const X extends Plugins = []>(
  definition: SolidFormDefinition<V, E, I, R, O, F, P>,
  ...args: CreateFormArgs<NoInfer<O>, NoInfer<E>, NoInfer<V>, X>
) => SolidForm<V, E, I, R, F, Combined<P, X>>;

/** See `CreateForm`. */
// The runtime builds the form the definition's types describe.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const createForm: CreateForm = createFormRuntime as unknown as CreateForm;

/**
 * A reusable value shape, not tied to one form: a token with the shape type
 * and `scope`. It is for type safety only. It registers no validator: the
 * form's own schema validates. An app's fieldset is an ordinary component
 * that takes a handle prop typed `HandleOf<typeof Shape>` and calls
 * `Shape.scope` in its body.
 */
export interface Fieldset<V, E = FormError, F extends FieldComponents = NoFieldComponents, P extends Plugins = []> {
  /** Type information only, always undefined at runtime. */
  readonly "~shape"?: FieldTypes<V, E>;
  /**
   * Returns the scope rooted at `handle`, the same object `forms.scope`
   * returns, typed to the shape. Call it in a component body. The fieldset
   * component reads its handle once, as everything in a Solid component
   * body is read: to move it to another handle, render it again under
   * `<Show when={handle} keyed>`.
   */
  scope(handle: FieldHandle<V, E>): Scope<V, E, F, P>;
}

/**
 * The handle type a fieldset component takes as its prop. Any handle
 * assignable to it fits: an object with more keys does, while a leaf of a
 * different type, even a wider or narrower one, does not. This is core's
 * handle assignability.
 */
export type HandleOf<T> = T extends { readonly "~shape"?: FieldTypes<infer V, infer E> } ? FieldHandle<V, E> : never;

/** Defines a fieldset shape. Neither form takes options or registers anything. */
export interface DefineFieldset<P extends Plugins, E, F extends FieldComponents> {
  /** The shape from a type, with no schema: `forms.fieldset<Address>()`. */
  <V>(): Fieldset<V, E, F, P>;
  /**
   * The shape from a schema: the `Draft` of its input when an installed
   * schema plugin accepts it, as `define` types it, and the input itself
   * otherwise. The schema only gives the type.
   */
  <S extends StandardSchemaV1>(schema: S): Fieldset<SchemaValue<S, P>, E, F, P>;
}

/**
 * `F` when every registered component has a `field` prop of a `FieldApi`
 * type, none takes a reserved name, and none declares a reserved prop (see
 * `ReservedProp`). A bad entry becomes `never`.
 */
export type CheckedFields<F> = {
  readonly [K in keyof F]: K extends ReservedName
    ? never
    : [FieldPropOf<F[K]>] extends [never]
      ? never
      : [Extract<keyof PropsOf<F[K]>, ReservedProp>] extends [never]
        ? F[K]
        : never;
};

/** Settings for `createForms`: core's settings plus the adapter's. */
export interface FormsOptions<P extends Plugins = [], E = FormError, F extends FieldComponents = NoFieldComponents>
  extends FormsConfig<P, E> {
  /** What happens after a submit ends invalid. Defaults to `true`. Each form can override it. */
  readonly focusOnInvalid?: FocusOnInvalid<E>;
  /**
   * The app's field components, by the name they get on every scope. Each
   * takes a `field` prop of a `FieldApi` type plus props of its own. A name
   * a scope or form uses itself (see `ReservedName`), or a `validate` prop
   * of its own (see `ReservedProp`), is a type error.
   */
  readonly fields?: F & CheckedFields<F>;
}

/**
 * What `createForms` returns. `define` takes what core's `define` takes,
 * with the same inference: `V` from the schema or `defaultValues`, `E` from
 * `mapError`, `I` from the annotation on `onSubmit`'s `ctx.intent`, `R` from
 * what `onSubmit` returns.
 */
export interface SolidForms<P extends Plugins = [], E = FormError, F extends FieldComponents = NoFieldComponents> {
  /** Defines a form. See core's `FormsCore.define`. Its own `plugins` join the shared ones. */
  define<V = never, S extends StandardSchemaV1 = never, O = void, I = undefined, R = unknown, const D extends Plugins = []>(
    config: DefineConfig<V, S, O, Combined<P, D>, E, I, R, D>,
  ): SolidFormDefinition<DefinedValue<V, S, Combined<P, D>>, E, I, R, O, F, Combined<P, D>>;
  /**
   * Returns the scope rooted at an object handle of any form made from
   * these settings, with the registered components. It returns the same
   * scope object, and so the same component functions, every time for the
   * same handle. It needs no context. Call it in a component body.
   */
  scope<S>(handle: ObjectHandle<S, E>): Scope<S, E, F, P>;
  /** Defines a fieldset shape. See `DefineFieldset`. */
  readonly fieldset: DefineFieldset<P, E, F>;
}

/**
 * The adapter's entry point. It wraps `createFormsCore`, takes the same
 * config plus the adapter's settings, and holds no state. Call it once at
 * module scope.
 */
export type CreateForms = <const P extends Plugins = [], E = FormError, F extends FieldComponents = NoFieldComponents>(
  options?: FormsOptions<P, E, F>,
) => SolidForms<P, E, F>;

/** See `CreateForms`. */
// The runtime builds every member the types name, with the types erased.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const createForms: CreateForms = createFormsRuntime as unknown as CreateForms;

/**
 * Reads a form from the nearest `form.Form` above. Every `form.Form`
 * provides the same context, and each remembers the `form.Form` above it.
 * Call it in a component body.
 */
export interface UseFormContext {
  /**
   * Returns the form from the nearest `form.Form`, of any definition, with
   * its types unknown. Use it in reusable parts such as a submit button.
   * Throws when no `form.Form` is above.
   */
  (): AnyForm;
  /**
   * Returns the form made from `definition`, fully typed, from the nearest
   * `form.Form` of that definition, even when another definition's
   * `form.Form` is nearer. Throws when no form of that definition is above.
   */
  <V, E, I, R, O, F extends FieldComponents, P extends Plugins>(
    definition: SolidFormDefinition<V, E, I, R, O, F, P>,
  ): SolidForm<V, E, I, R, F, P>;
}

/** See `UseFormContext`. */
// The context holds forms of any types. A form found by its definition is that definition's form.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const useFormContext: UseFormContext = useAnyForm as unknown as UseFormContext;

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

/** See `CreateDisabledErrors`. */
// The list comes from the store's `disabledInvalid()`, whose error type is the store's `E`.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const createDisabledErrors: CreateDisabledErrors = createDisabledErrorList as unknown as CreateDisabledErrors;
