import type {
  AnyFieldHandle,
  ChoiceHandle,
  ChoiceValue,
  Combined,
  DefineConfig,
  DefinedValue,
  DefineParts,
  DisabledInvalid,
  InvalidField,
  Draft,
  ErrorOf,
  FieldHandle,
  HandleBase,
  FormDefinition,
  FormError,
  FormsConfig,
  FormStore,
  HasChoice,
  IntentArgs,
  Needs,
  Nested,
  ObjectHandle,
  Part,
  PluginApis,
  PluginNames,
  Plugins,
  PluginsFor,
  PluginsOf,
  SchemaValue,
  StandardSchemaV1,
  Submission,
  ValidatorInput,
  ValueOf,
  WithChoice,
} from "@lunarhue/forms-core";
import type { Accessor } from "solid-js";
import type { SolidElement } from "./element.js";
import { createDisabledErrorList } from "./disabled-errors.js";
import { createInvalidFieldList } from "./invalid-fields.js";
import type { ExactFieldApi, FieldTypes, FormState, HandleLike } from "./field.js";
import { createFormRuntime, createFormsRuntime, useAnyForm } from "./forms-runtime.js";
import type { FieldPath, ValueAt } from "./path.js";

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
 * Props `Field` takes besides `name` or `handle`.
 *
 * Solid's `Field` has no `select`. Each member of the field object is its
 * own reactive read, so JSX that reads `field.errors.length` re-runs when the
 * errors change and at no other time. Read the members you need: render an
 * input with `field.inputProps`, or read one thing about a field, such as an
 * error count or a derived label, from that one member.
 */
interface FieldPropsBase<V, E, Installed extends string = never> {
  /** A validator added while this `Field` is mounted. See `ValidateProp` for the mounted-only rule. */
  readonly validate?: ValidateProp<V, E>;
  /** Renders the field. Runs once. */
  readonly children: (field: ExactFieldApi<V, E, Installed>) => SolidElement;
}

/**
 * Renders one field of a scope with its `ExactFieldApi`. Give exactly one of
 * `name`, a dotted path relative to the scope, or `handle`. See
 * `FieldPropsBase` for reading one thing about a field. TypeScript reports
 * the error of the last signature only, so the `name` signature, the common
 * one, comes last.
 */
export interface BoundField<V, E = FormError, Installed extends string = never> {
  <H extends HandleLike>(
    props: { readonly handle: H; readonly name?: never } & FieldPropsBase<ValueOf<H>, ErrorOf<H>, PluginsOf<H>>,
  ): SolidElement;
  <N extends FieldPath<V>>(
    props: { readonly name: N; readonly handle?: never } & FieldPropsBase<ValueAt<V, N>, E, Installed>,
  ): SolidElement;
}

/** Any Solid component. The constraint for registered field components. */
// `any` lets a component of any props fit. Each one is checked by `CheckedFields`.
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyComponent = (props: any) => SolidElement;

/**
 * A field component with the parts every field it renders gets, made by
 * `field`. `C` is the component and `N` the plugins its parts need.
 */
export interface FieldType<C extends AnyComponent = AnyComponent, N extends string = string> {
  /** The component, rendered as it is. */
  readonly component: C;
  /** What attaches at each field the component renders, the first time it renders it. */
  readonly parts: readonly Part[];
  /** Type information only: the plugins the parts need. */
  readonly "~needs"?: N;
  /**
   * The parts pinned at the dotted name `name`, for `define` to attach when
   * the store is made: `forms.define(config, PhoneField.at("phone"))`. Use
   * it for a field that may not render before its value matters.
   */
  at<K extends string>(name: K): readonly Part<N, Nested<K, PartValueOf<C>>>[];
}

/** The field components an app registers, by the name they get on every scope: plain components or `defineField(...)` results. */
// `FieldType<any>`: a FieldType is invariant in its component, since its
// parts take the component's field values, so only `any` fits every one.
// oxlint-disable-next-line typescript/no-explicit-any
export type FieldComponents = Readonly<Record<string, AnyComponent | FieldType<any>>>;

/** The component of a `fields` entry. */
export type ComponentOf<T> = T extends FieldType<infer C> ? C : T;

/** The plugins a `fields` entry's parts need. */
// oxlint-disable-next-line typescript/no-explicit-any
export type NeedsOf<T> = T extends FieldType<any, infer N> ? N : never;

/** No registered field components. */
// An object type with no keys is the point here: a form with no registered components gets no extra members.
// oxlint-disable-next-line typescript/no-generated-empty-object-type
export type NoFieldComponents = Readonly<Record<never, never>>;

/** The names a scope or form uses itself, which a registered component can't take. */
export type ReservedName =
  | "Field"
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

/** The props of a component, or of a `defineField(...)` entry's component. */
export type PropsOf<C> = ComponentOf<C> extends (props: infer P) => unknown ? P : never;

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

/** The plugins a registered component's `field` prop names, as `FieldApi<T, E, "dirty">` does. */
type FieldPluginsOf<C> = FieldPropOf<C> extends { readonly "~field"?: FieldTypes<unknown, unknown, infer N extends string> } ? N : never;

/**
 * The handles a registered component takes. A `FieldApi<T>` component takes
 * a handle of `Draft<T>` or of `T`, and both again with `undefined`, `null`
 * or both taken out of `T`. So a `FieldApi<string | undefined>` component
 * takes required and optional string fields. An `ExactFieldApi<V>`
 * component takes a handle of `V` only. Either takes only handles of forms
 * with the plugins its field names.
 */
export type ComponentHandle<C> =
  TakesDraft<C> extends true
    ? DraftOrExact<C, FieldValueOf<C>>
      | DraftOrExact<C, Exclude<FieldValueOf<C>, undefined>>
      | DraftOrExact<C, Exclude<FieldValueOf<C>, null>>
      | DraftOrExact<C, NonNullable<FieldValueOf<C>>>
    : FieldHandle<FieldValueOf<C>, FieldErrorOf<C>, FieldPluginsOf<C>>;

/** The handles of `Draft<T>` and of `T` for component `C`. Nothing for `never`. */
type DraftOrExact<C, T> = [T] extends [never]
  ? never
  : FieldHandle<Draft<T>, FieldErrorOf<C>, FieldPluginsOf<C>> | FieldHandle<T, FieldErrorOf<C>, FieldPluginsOf<C>>;

/** A registered component's own props: all of them except `field`. */
export type OwnProps<C> = Omit<PropsOf<C>, "field">;

/** The values a registered component's field accepts, as a part for it must fit them. */
export type PartValueOf<C> = ValueOf<ComponentHandle<C>>;

/**
 * True when a field of value `V` and error `E` fits registered component
 * `C`. The rule is core's handle assignability: the field's handle must be
 * assignable to one of `ComponentHandle<C>`. Leaf handles are invariant in
 * their value, so a `FieldApi<number>` component takes a `number | undefined`
 * field, the `Draft<number>` a schema form holds, and a plain form's
 * `number` field (see `FieldApi` for why that side is loose), but not a
 * `string` one. An object field may have more keys than the component's
 * type names. `Installed` is the names of the form's plugins.
 */
export type FitsComponent<V, E, C, Installed extends string = never> = [FieldHandle<V, E, Installed>] extends [ComponentHandle<C>]
  ? true
  : false;

/** The names in `V` whose fields fit registered component `C`. */
export type FitPath<V, E, C, Installed extends string = never> = {
  [P in FieldPath<V>]: FitsComponent<ValueAt<V, P>, E, C, Installed> extends true ? P : never;
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
export interface BoundFieldComponent<V, E, C, Installed extends string = never> {
  <H extends ComponentHandle<C>>(
    props: {
      readonly handle: H;
      readonly name?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidateProp<ValueOf<H>, ErrorOf<H>>;
    } & OwnProps<C>,
  ): SolidElement;
  <N extends FitPath<V, E, C, Installed>>(
    props: {
      readonly name: N;
      readonly handle?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidateProp<ValueAt<V, N>, E>;
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
export type ChoicePath<V, E, C, Installed extends string = never> =
  FieldPath<V> extends infer P
    ? P extends string
      ? [FieldHandle<ValueAt<V, P>, E, Installed>] extends [
          ChoiceHandle<ChoiceFieldOf<C>, ValueAt<V, P>, FieldErrorOf<C>, FieldPluginsOf<C>>,
        ]
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
export interface BoundChoiceComponent<V, E, C, Installed extends string = never> {
  <H extends HandleLike>(
    props: WithChoice<OwnProps<C>, ChoiceValue<ChoiceFieldOf<C>, ValueOf<H>>> & {
      readonly handle: H & ChoiceHandle<ChoiceFieldOf<C>, ValueOf<H>, FieldErrorOf<C>, FieldPluginsOf<C>>;
      readonly name?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidateProp<ValueOf<H>, ErrorOf<H>>;
    },
  ): SolidElement;
  <N extends ChoicePath<V, E, C, Installed>>(
    props: WithChoice<OwnProps<C>, ChoiceValue<ChoiceFieldOf<C>, ValueAt<V, N>>> & {
      readonly name: N;
      readonly handle?: never;
      /** A validator added while this component is mounted. See `ValidateProp` for the mounted-only rule. */
      readonly validate?: ValidateProp<ValueAt<V, N>, E>;
    },
  ): SolidElement;
}

/**
 * The registered components, bound to a scope of value `V`. A component
 * whose `FieldApi` is written with `Choice` is bound as
 * `BoundChoiceComponent`, every other one as `BoundFieldComponent`. A
 * component whose field names plugins, as `FieldApi<T, E, "dirty">` does,
 * takes only fields of forms that have them. `Installed` is the scope's.
 */
export type BoundFieldComponents<V, E, F extends FieldComponents, Installed extends string = never> = {
  readonly [K in keyof F]: Needs<
    Installed,
    NeedsOf<F[K]> | FieldPluginsOf<F[K]>,
    [ChoiceFieldOf<F[K]>] extends [never] ? BoundFieldComponent<V, E, F[K], Installed> : BoundChoiceComponent<V, E, F[K], Installed>,
    K & string
  >;
};

/**
 * The members every scope has. `R` is the root handle's value type: a
 * fieldset's scope types names by its shape `V` and keeps the handle it was
 * given as `root`.
 */
export interface ScopeMembers<V, E, Installed extends string = never, R = V> {
  /** The handle the scope is rooted at. Names are relative to it. */
  readonly root: FieldHandle<R, E, Installed>;
  /** Renders one field of the scope. */
  readonly Field: BoundField<V, E, Installed>;
}

/**
 * The bound components rooted at an object handle: `Field` and
 * every registered field component, with names relative to `root`.
 * `Installed` is the names of the form's plugins, see `ExactFieldApi`.
 */
export type Scope<V, E = FormError, F extends FieldComponents = NoFieldComponents, Installed extends string = never, R = V> = ScopeMembers<
  V,
  E,
  Installed,
  R
> &
  BoundFieldComponents<V, E, F, Installed>;

/** What a form has beyond its root scope. `P` is every plugin the form has. */
export interface FormMembers<V, E, I, R, F extends FieldComponents = NoFieldComponents, P extends Plugins = []> {
  /** The core store. Every handle's `store` is this object. */
  readonly store: FormStore<V, E, I, R, PluginApis<P>, PluginNames<P>>;
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
  readonly state: FormState<I, R, PluginNames<P>>;
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
> = Scope<V, E, F, PluginNames<P>> & FormMembers<V, E, I, R, F, P>;

/**
 * A form with its value, intent and result types unknown, as the generic
 * `useFormContext` returns it. Enough for `submit`, `formProps`, `state` and
 * `store`. With no arguments its error type is unknown too, and it has no
 * plugins or field components. `useFormContext(forms)` fills in the shared
 * plugins `P`, the error type `E` and the field components `F` of that
 * `createForms` call.
 */
export type AnyForm<P extends Plugins = [], E = unknown, F extends FieldComponents = NoFieldComponents> = SolidForm<
  unknown,
  E,
  unknown,
  unknown,
  F,
  P
>;

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

/**
 * The form a definition makes, `FormOf<typeof Signup>`, or the form
 * `useFormContext(forms)` returns, `FormOf<typeof forms>`.
 */
export type FormOf<D> = D extends { readonly "~form"?: infer T } ? T : never;

/**
 * Makes the form. Call it in a component body: the form's subscriptions end
 * with that owner. `options` is required when the definition was made with
 * the function form of `define`, and absent otherwise.
 */
export const createForm: <V, E, I, R, O, F extends FieldComponents, P extends Plugins, const X extends Plugins = []>(
  definition: SolidFormDefinition<V, E, I, R, O, F, P>,
  ...args: CreateFormArgs<NoInfer<O>, NoInfer<E>, NoInfer<V>, X>
) => SolidForm<V, E, I, R, F, Combined<P, X>> =
  // The runtime builds the form the definition's types describe.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  createFormRuntime as never;

/**
 * A reusable value shape, not tied to one form: a token with the shape type,
 * `scope`, and the parts that travel with it, such as `ruled(...)`. It
 * registers no validator: the form's own schema validates. An app's
 * fieldset is an ordinary component that takes a handle prop typed
 * `HandleOf<typeof Shape>` and calls `Shape.scope` in its body.
 *
 * `Installed` is the shared plugins of the `createForms` call, and `N` the
 * plugins the parts need. A handle fits only when its form has `N`.
 */
export interface Fieldset<V, E = FormError, F extends FieldComponents = NoFieldComponents, Installed extends string = never, N extends string = never> {
  /** Type information only, always undefined at runtime. */
  readonly "~shape"?: FieldTypes<V, E, N>;
  /**
   * Returns the scope rooted at `handle`, the same object `forms.scope`
   * returns, typed to the shape. Call it in a component body. The fieldset
   * component reads its handle once, as everything in a Solid component
   * body is read: to move it to another handle, render it again under
   * `<Show when={handle} keyed>`. The first call for a handle attaches the
   * parts at it.
   *
   * The handle's value may be any subtype of the shape, as in a component
   * generic in it. Names and bound components are typed by the shape, and
   * `root` keeps the handle's own value type, so writes through it still
   * take the whole value.
   */
  // It infers the handle, not W: a deferred FieldHandle<T> from a generic
  // component isn't assignable to FieldHandle<W> on a method of an
  // instantiated interface. HandleBase is covariant in its value.
  scope<H extends HandleBase<V, E, N>>(handle: H): Scope<V, E, F, Installed | N, ValueOf<H>>;
  /**
   * The parts pinned at the dotted name `name`, for `define` to attach when
   * the store is made: `forms.define(config, Billing.at("billing"))`. Use it
   * for a fieldset that may not render before its rules matter.
   */
  at<K extends string>(name: K): readonly Part<N, Nested<K, V>>[];
}

/**
 * The handle type a fieldset component takes as its prop. Handles are exact
 * in their value type, so `HandleOf<typeof Shape>` takes a handle whose
 * value is the shape: an item handle or a field of another form of the same
 * `createForms` fits, a handle of an object with more keys doesn't.
 *
 * For a component that takes wider objects too, make it generic and pass
 * the value type as `W`:
 * `function AddressFields<A extends Address>(props: { field: HandleOf<typeof Shape, A> })`.
 */
export type HandleOf<T, W extends ShapeValue<T> = ShapeValue<T>> = T extends {
  readonly "~shape"?: FieldTypes<unknown, infer E, infer N>;
}
  ? FieldHandle<W, E, N>
  : never;

/** The value type of a fieldset's shape. */
type ShapeValue<T> = T extends { readonly "~shape"?: { readonly value: infer V } } ? V : never;

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
  /** Type information only, always undefined at runtime: the form `useFormContext` returns for these forms. */
  readonly "~form"?: AnyForm<P, E, F>;
  /** Defines a form. See core's `FormsCore.define`. Its own `plugins` join the shared ones. */
  define<V = never, S extends StandardSchemaV1 = never, O = void, I = undefined, R = unknown, const D extends Plugins = []>(
    config: DefineConfig<V, S, O, Combined<P, D>, E, I, R, D>,
    ...parts: readonly DefineParts<V, S, P, D>[]
  ): SolidFormDefinition<DefinedValue<V, S, Combined<P, D>>, E, I, R, O, F, Combined<P, D>>;
  /**
   * Returns the scope rooted at an object handle of any form made from
   * these settings, with the registered components. It returns the same
   * scope object, and so the same component functions, every time for the
   * same handle. It needs no context. Call it in a component body.
   */
  scope<S, Installed extends string = never>(handle: ObjectHandle<S, E, Installed>): Scope<S, E, F, Installed>;
  /** Defines a fieldset shape, with parts that attach where its scope is taken. Neither form registers anything. */
  readonly fieldset: {
    /**
     * The shape from a type, with no schema: `forms.fieldset<Address>()`.
     * With parts, name their plugins too:
     * `forms.fieldset<Address, "rules">(ruled(...))`.
     */
    <V, N extends string = never>(...parts: readonly Part<N, V>[]): Fieldset<V, E, F, PluginNames<P>, N>;
    /**
     * The shape from a schema: the `Draft` of its input when an installed
     * schema plugin accepts it, as `define` types it, and the input itself
     * otherwise. The schema only gives the type.
     */
    <S extends StandardSchemaV1, N extends string = never>(
      schema: S,
      ...parts: readonly Part<N, SchemaValue<S, P>>[]
    ): Fieldset<SchemaValue<S, P>, E, F, PluginNames<P>, N>;
  };
}

/**
 * The adapter's entry point. It wraps `createFormsCore`, takes the same
 * config plus the adapter's settings, and holds no state. Call it once at
 * module scope.
 */
export const createForms: <const P extends Plugins = [], E = FormError, F extends FieldComponents = NoFieldComponents>(
  options?: FormsOptions<P, E, F>,
) => SolidForms<P, E, F> =
  // The runtime builds every member the types name, with the types erased.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  createFormsRuntime as never;

/**
 * Reads a form from the nearest `form.Form` above. Every `form.Form`
 * provides the same context, and each remembers the `form.Form` above it.
 * Call it in a component body.
 */
export const useFormContext: {
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
  /**
   * Returns the nearest form defined by `forms`, the object `createForms`
   * returned, for a part shared by its forms such as an undo button. Its
   * value type is unknown. Its plugins are the shared ones, its error type
   * and field components those of `forms`. Plugins a definition or a form
   * adds are not in its type. Forms from other `createForms` calls are
   * skipped. Throws when no form of `forms` is above.
   */
  <P extends Plugins, E, F extends FieldComponents>(forms: SolidForms<P, E, F>): AnyForm<P, E, F>;
} =
  // The context holds forms of any types. A form found by its definition or its forms is the form their types describe.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  useAnyForm as never;

/**
 * Returns the disabled fields with validation errors, as of the latest
 * submit that ended invalid, for showing at form level. The list is empty
 * until a submit ends invalid, and again once a later submit starts. While
 * the latest submit stays invalid it follows the form snapshot, so fixing or
 * enabling a field takes it off the list. Call it in a component body.
 */
export const createDisabledErrors: <V, E, I, R>(
  form: FormStore<V, E, I, R> | { readonly store: FormStore<V, E, I, R> },
) => Accessor<readonly DisabledInvalid<E>[]> =
  // The list comes from the store's `disabledInvalid()`, whose error type is the store's `E`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  createDisabledErrorList as never;

/**
 * Returns every field with errors, in value order, for an error summary:
 * core's `invalidFields`, validation errors and errors from `setErrors` alike.
 * It updates when a field gains or loses its errors, an error list changes,
 * or a field with errors moves. On the server it is empty. Call it in a
 * component body.
 */
export const createInvalidFields: <V, E, I, R>(
  form: FormStore<V, E, I, R> | { readonly store: FormStore<V, E, I, R> },
) => Accessor<readonly InvalidField<E>[]> =
  // The list comes from core's `invalidFields`, whose error type is the store's `E`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  createInvalidFieldList as never;
