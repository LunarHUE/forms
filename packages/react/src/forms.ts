import type {
  AnyFieldHandle,
  AnyFormStore,
  Combined,
  DefineConfig,
  DefinedValue,
  DefineParts,
  DisabledInvalid,
  ErrorOf,
  FormDefinition,
  FormError,
  FormsConfig,
  FormSnapshot,
  FormStore,
  IntentArgs,
  InvalidField,
  Part,
  PluginApis,
  PluginNames,
  Plugins,
  PluginsOf,
  PluginsFor,
  SchemaValue,
  StandardSchemaV1,
  Submission,
  ValueOf,
} from "@lunarhue/forms-core";
import { attach, createFormsCore, invalidFields, subscribeInvalid } from "@lunarhue/forms-core";
import { createContext, createElement, Fragment, type ReactElement, type ReactNode, useContext, useMemo, useState } from "react";
import { type AnyScope, makeScope } from "./bound.js";
import { generatedIdUsed, useId, useSyncExternalStore } from "#lunarhue/react";
import type { HandleLike, IsEqual } from "./field.js";
import { problem } from "./problem.js";
import { focusInvalid, refFor } from "./refs.js";
import { pin } from "./field-type.js";
import type { FieldComponentMap, FieldPropOf, Fieldset, NoFields, PropsOf, Scope } from "./scope.js";
import { cached, useSelected } from "./select.js";
import { formSource, storeOf } from "./sources.js";

/**
 * What a failed submit leaves to focus. The adapter builds it from core's
 * `firstInvalid()` and `disabledInvalid()` after a submit ends invalid.
 */
export interface FocusTarget<E = FormError> {
  /** Core's `firstInvalid()`: the first enabled field with a validation error, or undefined. */
  readonly field: AnyFieldHandle<E> | undefined;
  /**
   * Core's `disabledInvalid()`: the disabled fields whose errors blocked the
   * submit. Their inputs can't take focus, so `useDisabledErrors` shows them
   * at form level.
   */
  readonly disabled: readonly DisabledInvalid<E>[];
  /**
   * The element the default focuses: the first element, in document order,
   * recorded for `field`. When `field` is undefined or has no element
   * mounted, it is the `<form>` element from the form props' `ref`.
   * Undefined only when no form element is mounted either.
   */
  readonly element: HTMLElement | undefined;
}

/**
 * What happens after a submit ends invalid. `true`, the default, focuses
 * `FocusTarget.element`. So the first enabled invalid field gets focus, and
 * when only disabled fields are invalid the form element gets it and
 * `useDisabledErrors` lists their errors. `false` does nothing. A function
 * replaces the default and is called after every invalid submit.
 */
export type FocusOnInvalid<E = FormError> = boolean | ((target: FocusTarget<E>) => void);

/** The names the form object uses itself, which a registered field component can't take. */
export type ReservedName =
  | "Field"
  | "Form"
  | "State"
  | "store"
  | "root"
  | "id"
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

/**
 * Checks the `fields` passed to `createForms`: a reserved name, a component
 * with no `field` prop, or a component that declares a reserved prop,
 * becomes `never`, which is a compile error at that entry.
 */
export type CheckedFields<F extends FieldComponentMap> = {
  readonly [K in keyof F]: K extends ReservedName
    ? never
    : [FieldPropOf<F[K]>] extends [never]
      ? never
      : [Extract<keyof PropsOf<F[K]>, ReservedProp>] extends [never]
        ? F[K]
        : never;
};

/** Settings for `createForms`: core's settings plus the adapter's. */
export interface FormsOptions<P extends Plugins = [], E = FormError, F extends FieldComponentMap = NoFields>
  extends FormsConfig<P, E> {
  /** What happens after a submit ends invalid. Defaults to `true`. */
  readonly focusOnInvalid?: FocusOnInvalid<E>;
  /**
   * The app's field components. Each is an ordinary component with a
   * `field: FieldApi<T>` prop and any props of its own, and shows up bound,
   * under the same name, on every form and scope. See `FieldApi` for which
   * fields fit, and `BoundFieldComponents` for a known hole in error types.
   */
  readonly fields?: F & CheckedFields<F>;
}

/**
 * Per-form settings for `useForm`. Read when the form is made. `V` is the
 * form's value type and `X` its own plugins.
 */
export interface UseFormOptions<E = FormError, V = unknown, X extends Plugins = Plugins> {
  /**
   * The store id, which prefixes every handle id and so every DOM id.
   * Defaults to an id from `useId`, which matches between server and client.
   * React 16.8 and 17 have no `useId`, so there the default is a counter that
   * doesn't match. Pass `id` to server render a form on those versions.
   */
  readonly id?: string;
  /** Overrides the `focusOnInvalid` given to `createForms`. */
  readonly focusOnInvalid?: FocusOnInvalid<E>;
  /**
   * Plugins for this form only, such as `zustand(store)` from
   * `@lunarhue/forms-bind/zustand` with a store this component made. They
   * run after the shared plugins and the definition's. The list is read
   * once, when the form is made: a later render with a different list
   * changes nothing. A plugin that names a value type, as a binding does,
   * must name the form's.
   */
  readonly plugins?: X & PluginsFor<V>;
}

/** Props for the `<form>` element. */
export interface FormElementProps {
  /** The store id. */
  readonly id: string;
  /** Turns off the browser's own validation, since the form validates itself. */
  readonly noValidate: true;
  /**
   * -1, so the adapter can focus the form after a submit that only disabled
   * fields blocked, without putting the form in the tab order.
   */
  readonly tabIndex: -1;
  /**
   * Calls `handleSubmit`. It needs only `preventDefault`, so the type fits
   * `<form onSubmit>` in the types of every React version.
   */
  readonly onSubmit: (event: { preventDefault(): void }) => void;
  /** Records the form element as the focus fallback. Same cleanup rules as `FieldRef`. */
  readonly ref: (element: HTMLFormElement | null) => (() => void) | undefined;
}

/** Props for `form.Form`, where `T` is the form that owns it. */
export interface FormComponentProps<T> {
  /**
   * A function gets the form element props and the form:
   * `{(formProps, form) => <form {...formProps}>...</form>}`. Spread the
   * first on a real `<form>` as it is. Plain nodes are rendered as they are,
   * with the context only.
   */
  readonly children?: ((formProps: FormElementProps, form: T) => ReactNode) | ReactNode;
}

/**
 * `form.Form`: renders no element. It provides the form to everything
 * below, for `useFormContext`. `T` is the form that owns it.
 */
export type FormComponent<T> = (props: FormComponentProps<T>) => ReactElement;

/** The form's own members, on top of the scope at its root. `P` is every plugin the form has. */
export interface FormMembers<V, E, I, R, F extends FieldComponentMap = NoFields, P extends Plugins = []> {
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
  /** The form element props, the same object `form.Form` passes to its child first. */
  readonly formProps: FormElementProps;
  /**
   * Submits with an intent, as `store.submit` does, then applies
   * `focusOnInvalid` when the submit ends invalid. `store.submit` itself
   * never moves focus. Bound, so it can be passed on as it is.
   */
  readonly submit: (...args: IntentArgs<I>) => Promise<Submission<I, R>>;
  /** As `store.handleSubmit`, then applies `focusOnInvalid` when the submit ends invalid. Bound. */
  readonly handleSubmit: (event?: { preventDefault(): void }) => Promise<void>;
  /** The headless provider. See `FormComponent`. */
  readonly Form: FormComponent<FormInstance<V, E, I, R, F, P>>;
  /** Renders a selection of the form snapshot. See `FormStateComponent`. */
  readonly State: FormStateComponent<I, R, FormInstance<V, E, I, R, F, P>, PluginNames<P>>;
}

/**
 * A form mounted in a component: the scope at its root plus the submit
 * members. It is made once per mounted form, together with its store and its
 * bound components, so every member keeps its identity for the life of the
 * form. It holds no state: read state with `useField`, `useFormState` and
 * the bound components. Every member works with no `form.Form` above.
 */
export type FormInstance<
  V,
  E = FormError,
  I = undefined,
  R = unknown,
  F extends FieldComponentMap = NoFields,
  P extends Plugins = [],
> = Scope<V, E, F, PluginNames<P>> & FormMembers<V, E, I, R, F, P>;

/**
 * A form of unknown value, intent and result type, as the generic context
 * reader returns it. With no arguments its error type is unknown too, and it
 * has no plugins or field components. `useFormContext(forms)` fills in the
 * shared plugins `P`, the error type `E` and the field components `F` of
 * that `createForms` call.
 */
export type UnknownForm<P extends Plugins = [], E = unknown, F extends FieldComponentMap = NoFields> = FormInstance<
  unknown,
  E,
  unknown,
  unknown,
  F,
  P
>;

/**
 * The arguments `useForm` takes after the definition: its options unless
 * they are `void`, then per-form settings. `V` is the form's value type and
 * `X` its own plugins.
 */
export type UseFormArgs<O, E, V = unknown, X extends Plugins = Plugins> = [O] extends [void]
  ? [instance?: UseFormOptions<E, V, X>]
  : [options: O, instance?: UseFormOptions<E, V, X>];

/**
 * A form definition for React: what `useForm` and `useFormContext` take. It
 * carries the schema, the validators and the registered field components,
 * and still has core's `createStore`, for tests and code outside components.
 */
export interface ReactFormDefinition<
  V,
  E = FormError,
  I = undefined,
  R = unknown,
  O = void,
  F extends FieldComponentMap = NoFields,
  P extends Plugins = [],
> extends FormDefinition<V, E, I, R, O, P> {
  /** Type information only, always undefined at runtime: the form `useForm` makes from this definition. */
  readonly "~form"?: FormInstance<V, E, I, R, F, P>;
}

/**
 * The form a definition makes, `FormOf<typeof signUp>`, or the form
 * `useFormContext(forms)` returns, `FormOf<typeof forms>`.
 */
export type FormOf<D> = D extends { readonly "~form"?: infer T } ? T : never;

/** Props for `form.State`, where `T` is the form that owns it and `Installed` the names of its plugins. */
export interface FormStateProps<I, R, S, T, Installed extends string = never> {
  /** Picks what to render from the form snapshot. It may be an inline function, as `useFormState`'s `select`. */
  readonly select: (snapshot: FormSnapshot<I, R, Installed>) => S;
  /** Compares two selected values. Return true to skip the re-render. Defaults to `Object.is`. */
  readonly isEqual?: IsEqual<S>;
  /** Renders the selected value. Gets the form too. */
  readonly children: (selected: S, form: T) => ReactNode;
}

/**
 * `form.State`: reads the form snapshot inline, as `useFormState` with
 * `select` does, and renders its children with the result. Only its own
 * children re-render, and only when the selected value changes by
 * `isEqual`. It needs no `form.Form` above.
 */
export type FormStateComponent<I, R, T, Installed extends string = never> = <S>(
  props: FormStateProps<I, R, S, T, Installed>,
) => ReactElement;

/** What `forms.scope` needs: an object handle. */
export interface ObjectHandleLike extends HandleLike {
  /** Returns a child handle. */
  at(key: never): unknown;
}

/**
 * What `createForms` returns: `define` for forms, `scope` for the bound
 * components of any object handle, and `fieldset` for reusable shapes.
 */
export interface Forms<P extends Plugins = [], E = FormError, F extends FieldComponentMap = NoFields> {
  /** Type information only, always undefined at runtime: the form `useFormContext` returns for these forms. */
  readonly "~form"?: UnknownForm<P, E, F>;
  /**
   * As core's `FormsCore.define`, returning a definition for `useForm` and
   * `useFormContext`. The same cases decide the value type, and `E`, `I`,
   * `R` and the definition's own plugins `D` are inferred the same way.
   */
  define<V = never, S extends StandardSchemaV1 = never, O = void, I = undefined, R = unknown, const D extends Plugins = []>(
    config: DefineConfig<V, S, O, P, E, I, R, D>,
    ...parts: readonly DefineParts<V, S, P, D>[]
  ): ReactFormDefinition<DefinedValue<V, S, Combined<P, D>>, E, I, R, O, F, Combined<P, D>>;
  /**
   * Returns the scope rooted at an object handle of any form made here.
   * Scopes are cached per handle, so one handle always gives the same object
   * and the same components. It is a cached lookup, not a hook: it reads no
   * state, so it can be called anywhere, render included, and needs no
   * `form.Form` above.
   */
  scope<H extends ObjectHandleLike>(handle: H): Scope<ValueOf<H>, ErrorOf<H>, F, PluginsOf<H>>;
  /**
   * Makes a reusable shape from a schema. The shape is the schema's value
   * type as `define` would type it: the `Draft` of its input when an
   * installed schema plugin accepts the schema, its input otherwise. The
   * schema only types the shape. It is never run, since the form's own
   * schema validates. Parts after the schema, such as `ruled(...)`, attach
   * where the fieldset's scope is taken.
   */
  fieldset<S extends StandardSchemaV1, N extends string = never>(
    schema: S,
    ...parts: readonly Part<N, SchemaValue<S, P>>[]
  ): Fieldset<SchemaValue<S, P>, E, F, PluginNames<P>, N>;
  /**
   * Makes a reusable shape from a type, with no schema:
   * `forms.fieldset<Address>()`. With parts, name their plugins too:
   * `forms.fieldset<Address, "rules">(ruled(...))`.
   */
  fieldset<V, N extends string = never>(...parts: readonly Part<N, V>[]): Fieldset<V, E, F, PluginNames<P>, N>;
}

/** A form as the runtime builds it. */
type AnyForm = AnyScope & { readonly store: AnyFormStore<unknown> };

/** What a `form.Form` provides: its form, and what the `form.Form` above it provides. */
interface FormNode {
  readonly form: AnyForm;
  readonly parent: FormNode | null;
}

/** The context every `form.Form` provides, whatever its definition. */
const FormContext = createContext<FormNode | null>(null);

/** The definition each form was made from. */
const madeFrom = new WeakMap<AnyForm, object>();

/** The `createForms` result each form was defined by. */
const madeBy = new WeakMap<AnyForm, object>();

/** How each definition makes a form, from `useForm`'s arguments after the definition and the generated id. */
const makers = new WeakMap<object, (args: readonly unknown[], generatedId: string) => AnyForm>();

/** Builds the form object around a new store. */
function makeForm(store: AnyFormStore<unknown>, scope: AnyScope, focus: FocusOnInvalid<unknown>): AnyForm {
  const submit = async (...args: [intent?: unknown]) => {
    const submission = await store.submit(...args);
    if (submission.status === "invalid") focusInvalid(store, focus);
    return submission;
  };
  const handleSubmit = async (event?: { preventDefault(): void }) => {
    event?.preventDefault();
    await submit();
  };
  const formProps: FormElementProps = {
    id: store.id,
    noValidate: true,
    tabIndex: -1,
    onSubmit: (event) => {
      void handleSubmit(event);
    },
    ref: refFor(store),
  };
  // `Form` only runs after `form` below is made.
  function Form(props: FormComponentProps<AnyForm>): ReactElement {
    const { children } = props;
    const parent = useContext(FormContext);
    const node = useMemo(() => ({ form, parent }), [parent]);
    const content = typeof children === "function" ? children(formProps, form) : children;
    return createElement(FormContext.Provider, { value: node }, content);
  }
  function State(props: FormStateProps<unknown, unknown, unknown, AnyForm>): ReactElement {
    const selected = useSelected(formSource(store), props.select, props.isEqual);
    return createElement(Fragment, null, props.children(selected, form));
  }
  const form: AnyForm = { ...scope, store, id: store.id, plugins: store.plugins, formProps, submit, handleSubmit, Form, State };
  return form;
}

/** Core's `define` as the runtime calls it, with every type erased. */
interface LooseCore {
  define(config: unknown, ...parts: readonly Part[]): {
    createStore(options: unknown, instance?: { readonly id: string; readonly plugins: Plugins | undefined }): AnyFormStore<unknown>;
  };
}

/**
 * The adapter's entry point. It wraps `createFormsCore`. Call it once at
 * module scope. `P` is inferred from `plugins` as a tuple, `E` from
 * `mapError` and `F` from `fields`.
 */
export const createForms: <const P extends Plugins = [], E = FormError, F extends FieldComponentMap = NoFields>(
  options?: FormsOptions<P, E, F>,
) => Forms<P, E, F> = (options = {}) => {
  // The runtime is untyped inside. The contract's types are checked by the type tests.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const core = createFormsCore(options) as unknown as LooseCore;
  const fields: FieldComponentMap = options.fields ?? {};
  const scopes = new WeakMap<object, AnyScope>();
  // Every form made here shares this cache, so one handle always gives the same components.
  const scope = (handle: AnyScope["root"]): AnyScope => cached(scopes, handle, () => makeScope(handle, fields));
  // `E` only types errors, so the runtime reads the setting with any error type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const defaultFocus = (options.focusOnInvalid ?? true) as FocusOnInvalid<unknown>;

  const define = (config: unknown, ...parts: readonly Part[]) => {
    const definition = core.define(config, ...parts);
    const takesOptions = typeof config === "function";
    makers.set(definition, (args, generatedId) => {
      // `useForm` takes the definition's options first only when the definition is a function.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const instance = (takesOptions ? args[1] : args[0]) as UseFormOptions<unknown> | undefined;
      const id = instance?.id;
      if (id === undefined) generatedIdUsed();
      const store = definition.createStore(takesOptions ? args[0] : undefined, { id: id ?? generatedId, plugins: instance?.plugins });
      const form = makeForm(store, scope(store.root), instance?.focusOnInvalid ?? defaultFocus);
      madeFrom.set(form, definition);
      madeBy.set(form, forms);
      return form;
    });
    return definition;
  };

  // A fieldset's first argument is its schema, or its first part when it has no schema.
  const fieldset = (first?: object, ...rest: readonly Part[]) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const parts = first === undefined || "~standard" in first ? rest : [first as Part, ...rest];
    return {
      scope(handle: AnyScope["root"]) {
        attach(handle, parts);
        return scope(handle);
      },
      at: (name: string) => pin(parts, name),
    };
  };

  const forms = { define, scope, fieldset };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return forms as never;
};

/**
 * Makes the form on the first render and returns the same object on every
 * render after. The store and the bound components are made in a `useState`
 * initialiser, so they survive re-renders and are dropped with the
 * component. StrictMode may run the initialiser twice and keep one result.
 * Making a store has no side effects, so the other is garbage. `options` is
 * required when the definition was made with the function form of `define`,
 * and absent otherwise. `options` and `instance` are read on the first render
 * only. When a later render passes a different definition, as a hot reload
 * does, `useForm` makes a new form from it with the current arguments and
 * returns that one from then on. The old form's values are dropped.
 */
export const useForm: <V, E, I, R, O, F extends FieldComponentMap, P extends Plugins, const X extends Plugins = []>(
  definition: ReactFormDefinition<V, E, I, R, O, F, P>,
  ...args: UseFormArgs<NoInfer<O>, NoInfer<E>, NoInfer<V>, X>
) => FormInstance<V, E, I, R, F, Combined<P, X>> = (definition, ...args) => {
  const generatedId = useId();
  const make = () => {
    const maker = makers.get(definition);
    if (maker === undefined) throw new Error(problem("form:definition"));
    return maker(args, generatedId);
  };
  const [form, setForm] = useState(make);
  // A hot reload runs the module again and passes a new definition while React keeps the old form.
  // Swap in a form from the new definition. React renders again at once, before any child sees the old one.
  if (madeFrom.get(form) !== definition) setForm(make());
  // The runtime form is the one the definition's types describe.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return form as never;
};

/**
 * Reads a form from the nearest `form.Form` above. Every `form.Form`
 * provides the same context, and each remembers the `form.Form` above it.
 */
export const useFormContext: {
  /**
   * Returns the form from the nearest `form.Form`, whatever its definition,
   * with its types unknown. Enough for reusable parts such as a submit
   * button: `submit`, `handleSubmit`, `formProps`, `store`, `useFormState`
   * and `useDisabledErrors`. Throws when no `form.Form` is above.
   */
  (): UnknownForm;
  /**
   * Returns the form made from `definition`, fully typed, from the nearest
   * `form.Form` of that definition. Forms of other definitions nearer to it,
   * such as a dialog's form inside a page's form, are skipped. Throws when no
   * form of that definition is above.
   */
  <V, E, I, R, O, F extends FieldComponentMap, P extends Plugins>(
    definition: ReactFormDefinition<V, E, I, R, O, F, P>,
  ): FormInstance<V, E, I, R, F, P>;
  /**
   * Returns the nearest form defined by `forms`, the object `createForms`
   * returned, for a part shared by its forms such as an undo button. Its
   * value type is unknown. Its plugins are the shared ones, its error type
   * and field components those of `forms`. Plugins a definition or a form
   * adds are not in its type. Forms from other `createForms` calls are
   * skipped. Throws when no form of `forms` is above.
   */
  <P extends Plugins, E, F extends FieldComponentMap>(forms: Forms<P, E, F>): UnknownForm<P, E, F>;
} = (definition?: object) => {
  let node = useContext(FormContext);
  if (definition !== undefined) {
    while (node !== null && madeFrom.get(node.form) !== definition && madeBy.get(node.form) !== definition) node = node.parent;
  }
  if (node === null) {
    throw new Error(problem(definition === undefined ? "context:form" : "define" in definition ? "context:forms" : "context:definition"));
  }
  // A form found by its definition or its forms is the form their types describe. With neither the caller gets `UnknownForm`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return node.form as never;
};

/** The disabled fields that blocked one submit, by the submit count they belong to. */
interface DisabledList {
  readonly submitCount: number;
  readonly list: readonly DisabledInvalid<unknown>[];
}

const noneDisabled: readonly DisabledInvalid<unknown>[] = [];
const disabledLists = new WeakMap<object, DisabledList>();

/** The list for one form snapshot. It is taken once per submit that ends invalid and kept until the next. */
function disabledFor(store: AnyFormStore<unknown>, snapshot: FormSnapshot<unknown>): readonly DisabledInvalid<unknown>[] {
  if (snapshot.submission.status !== "invalid") return noneDisabled;
  let entry = disabledLists.get(store);
  if (entry?.submitCount !== snapshot.submitCount) {
    entry = { submitCount: snapshot.submitCount, list: store.disabledInvalid() };
    disabledLists.set(store, entry);
  }
  return entry.list;
}

/**
 * Returns the disabled fields whose errors blocked the last submit that
 * ended invalid, for showing at form level. The adapter takes the list from
 * core's `disabledInvalid()` when the form snapshot's submission becomes
 * `invalid`, whoever started the submit, and empties it when the submission
 * leaves `invalid` (the next submit starts, or the form resets). The list
 * keeps its identity in between. Takes the form or any store, such as
 * `handle.store`.
 */
export const useDisabledErrors = <E>(
  form: AnyFormStore<E> | { readonly store: AnyFormStore<E> },
): readonly DisabledInvalid<E>[] => {
  // The error type only types the list, which comes from this store.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const store = storeOf(form) as AnyFormStore<unknown>;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return useSelected(formSource(store), (snapshot) => disabledFor(store, snapshot)) as readonly DisabledInvalid<E>[];
};

const noFields: readonly InvalidField<unknown>[] = [];
const invalidLists = new WeakMap<object, readonly InvalidField<unknown>[]>();

/** True when two lists name the same fields, with the same names and error lists. */
const sameFields = (a: readonly InvalidField<unknown>[], b: readonly InvalidField<unknown>[]): boolean =>
  a.length === b.length && a.every((entry, i) => entry.field === b[i]?.field && entry.name === b[i]?.name && entry.errors === b[i]?.errors);

/** Core's `invalidFields(store)`, as the same list object until an entry changes. */
function invalidFor(store: AnyFormStore<unknown>): readonly InvalidField<unknown>[] {
  const next = invalidFields(store);
  const last = invalidLists.get(store) ?? noFields;
  if (sameFields(last, next)) return last;
  invalidLists.set(store, next);
  return next;
}

/**
 * Returns every field with errors, in value order, for an error summary:
 * core's `invalidFields`, validation errors and errors from `setErrors` alike.
 * It re-renders when a field gains or loses its errors, an error list
 * changes, or a field with errors moves, and the list keeps its identity in
 * between. The server render gets an empty list. Takes the form or any
 * store, such as `handle.store`.
 */
export const useInvalidFields = <E>(form: AnyFormStore<E> | { readonly store: AnyFormStore<E> }): readonly InvalidField<E>[] => {
  // The error type only types the list, which comes from this store.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const store = storeOf(form) as AnyFormStore<unknown>;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return useSyncExternalStore(
    (listener) => subscribeInvalid(store, listener),
    () => invalidFor(store),
    () => noFields,
  ) as readonly InvalidField<E>[];
};
