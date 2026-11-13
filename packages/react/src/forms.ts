import type {
  AnyFieldHandle,
  AnyFormStore,
  DefinedValue,
  Definition,
  DisabledInvalid,
  ErrorOf,
  FormDefinition,
  FormError,
  FormsConfig,
  FormSnapshot,
  FormStore,
  IntentArgs,
  SchemaAdapter,
  SchemaValue,
  StandardSchemaV1,
  StoreInstance,
  Submission,
  ValueOf,
} from "@lunarhue/forms-core";
import { createFormsCore } from "@lunarhue/forms-core";
import { createContext, createElement, Fragment, type ReactElement, type ReactNode, useContext, useMemo, useState } from "react";
import { type AnyScope, makeScope } from "./bound.js";
import { generatedIdUsed, useId } from "./compat.js";
import type { HandleLike, IsEqual } from "./field.js";
import { focusInvalid, formRef } from "./refs.js";
import type { FieldComponentMap, FieldPropOf, Fieldset, NoFields, Scope } from "./scope.js";
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
  | "Items"
  | "Form"
  | "State"
  | "store"
  | "root"
  | "id"
  | "formProps"
  | "submit"
  | "handleSubmit";

/**
 * Checks the `fields` passed to `createForms`: a reserved name, or a
 * component with no `field` prop, becomes `never`, which is a compile error
 * at that entry.
 */
export type CheckedFields<F extends FieldComponentMap> = {
  readonly [K in keyof F]: K extends ReservedName ? never : [FieldPropOf<F[K]>] extends [never] ? never : F[K];
};

/** Settings for `createForms`: core's settings plus the adapter's. */
export interface FormsOptions<
  A extends readonly SchemaAdapter<never>[] = [],
  E = FormError,
  F extends FieldComponentMap = NoFields,
> extends FormsConfig<A, E> {
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

/** Per-form settings for `useForm`. Read when the form is made. */
export interface UseFormOptions<E = FormError> {
  /**
   * The store id, which prefixes every handle id and so every DOM id.
   * Defaults to an id from `useId`, which matches between server and client.
   * React 16.8 and 17 have no `useId`, so there the default is a counter that
   * doesn't match. Pass `id` to server render a form on those versions.
   */
  readonly id?: string;
  /** Overrides the `focusOnInvalid` given to `createForms`. */
  readonly focusOnInvalid?: FocusOnInvalid<E>;
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

/** The form's own members, on top of the scope at its root. */
export interface FormMembers<V, E, I, R, F extends FieldComponentMap = NoFields> {
  /** The core store. Every handle's `store` is this object. */
  readonly store: FormStore<V, E, I, R>;
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
  readonly Form: FormComponent<FormInstance<V, E, I, R, F>>;
  /** Renders a selection of the form snapshot. See `FormStateComponent`. */
  readonly State: FormStateComponent<I, R, FormInstance<V, E, I, R, F>>;
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
> = Scope<V, E, F> & FormMembers<V, E, I, R, F>;

/** A form of unknown value, error, intent and result type, as the generic context reader returns it. */
export type UnknownForm = FormInstance<unknown, unknown, unknown>;

/** The arguments `useForm` takes after the definition: its options unless they are `void`, then per-form settings. */
export type UseFormArgs<O, E> = [O] extends [void]
  ? [instance?: UseFormOptions<E>]
  : [options: O, instance?: UseFormOptions<E>];

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
> extends FormDefinition<V, E, I, R, O> {
  /** Type information only, always undefined at runtime: the form `useForm` makes from this definition. */
  readonly "~form"?: FormInstance<V, E, I, R, F>;
}

/** The form a definition makes: `FormOf<typeof signUp>`. */
export type FormOf<D> = D extends { readonly "~form"?: infer T } ? T : never;

/** Props for `form.State`, where `T` is the form that owns it. */
export interface FormStateProps<I, R, S, T> {
  /** Picks what to render from the form snapshot. It may be an inline function, as `useFormState`'s `select`. */
  readonly select: (snapshot: FormSnapshot<I, R>) => S;
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
export type FormStateComponent<I, R, T> = <S>(props: FormStateProps<I, R, S, T>) => ReactElement;

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
export type UseForm = <V, E, I, R, O, F extends FieldComponentMap>(
  definition: ReactFormDefinition<V, E, I, R, O, F>,
  ...args: NoInfer<UseFormArgs<O, E>>
) => FormInstance<V, E, I, R, F>;

/**
 * Reads a form from the nearest `form.Form` above. Every `form.Form`
 * provides the same context, and each remembers the `form.Form` above it.
 */
export interface UseFormContext {
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
  <V, E, I, R, O, F extends FieldComponentMap>(definition: ReactFormDefinition<V, E, I, R, O, F>): FormInstance<V, E, I, R, F>;
}

/** What `forms.scope` needs: an object handle. */
export interface ObjectHandleLike extends HandleLike {
  /** Returns a child handle. */
  at(key: never): unknown;
}

/**
 * What `createForms` returns: `define` for forms, `scope` for the bound
 * components of any object handle, and `fieldset` for reusable shapes.
 */
export interface Forms<
  A extends readonly SchemaAdapter<never>[] = [],
  E = FormError,
  F extends FieldComponentMap = NoFields,
> {
  /**
   * As core's `FormsCore.define`, returning a definition for `useForm` and
   * `useFormContext`. The same three cases decide the value type, and `E`,
   * `I` and `R` are inferred the same way.
   */
  define<V = never, S extends StandardSchemaV1 = never, O = void, I = undefined, R = unknown>(
    config: Definition<V, S, A, E, I, R> | ((options: O) => Definition<V, S, A, E, I, R>),
  ): ReactFormDefinition<DefinedValue<V, S, A>, E, I, R, O, F>;
  /**
   * Returns the scope rooted at an object handle of any form made here.
   * Scopes are cached per handle, so one handle always gives the same object
   * and the same components. It is a cached lookup, not a hook: it reads no
   * state, so it can be called anywhere, render included, and needs no
   * `form.Form` above.
   */
  scope<H extends ObjectHandleLike>(handle: H): Scope<ValueOf<H>, ErrorOf<H>, F>;
  /**
   * Makes a reusable shape from a schema. The shape is the schema's value
   * type as `define` would type it: the `Draft` of its input when a
   * registered adapter supports the schema, its input otherwise. The schema
   * only types the shape. It is never run, since the form's own schema
   * validates.
   */
  fieldset<S extends StandardSchemaV1>(schema: S): Fieldset<SchemaValue<S, A>, E, F>;
  /** Makes a reusable shape from a type, with no schema: `forms.fieldset<Address>()`. */
  fieldset<V>(): Fieldset<V, E, F>;
}

/**
 * The adapter's entry point. It wraps `createFormsCore`. Call it once at
 * module scope. `E` is inferred from `mapError` and `F` from `fields`.
 */
export type CreateForms = <
  const A extends readonly SchemaAdapter<never>[] = [],
  E = FormError,
  F extends FieldComponentMap = NoFields,
>(
  options?: FormsOptions<A, E, F>,
) => Forms<A, E, F>;

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
    ref: formRef(store),
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
  const form: AnyForm = { ...scope, store, id: store.id, formProps, submit, handleSubmit, Form, State };
  return form;
}

/** Core's `define` as the runtime calls it, with every type erased. */
interface LooseCore {
  define(config: unknown): { createStore(options: unknown, instance: StoreInstance): AnyFormStore<unknown> };
}

/** See `CreateForms`. */
export const createForms: CreateForms = (options = {}) => {
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

  const define = (config: unknown) => {
    const made = core.define(config);
    const takesOptions = typeof config === "function";
    const definition = {
      createStore: (storeOptions: unknown, instance: StoreInstance = {}) => made.createStore(storeOptions, instance),
    };
    makers.set(definition, (args, generatedId) => {
      // `useForm` takes the definition's options first only when the definition is a function.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const instance = (takesOptions ? args[1] : args[0]) as UseFormOptions<unknown> | undefined;
      const id = instance?.id;
      if (id === undefined) generatedIdUsed();
      const store = made.createStore(takesOptions ? args[0] : undefined, { id: id ?? generatedId });
      const form = makeForm(store, scope(store.root), instance?.focusOnInvalid ?? defaultFocus);
      madeFrom.set(form, definition);
      return form;
    });
    return definition;
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { define, scope, fieldset: () => ({ scope }) } as never;
};

/** See `UseForm`. */
export const useForm: UseForm = (definition, ...args) => {
  const generatedId = useId();
  const make = () => {
    const maker = makers.get(definition);
    if (maker === undefined) throw new Error("@lunarhue/forms-react: useForm takes a definition from forms.define.");
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

/** See `UseFormContext`. */
export const useFormContext: UseFormContext = (definition?: object) => {
  let node = useContext(FormContext);
  if (definition !== undefined) {
    while (node !== null && madeFrom.get(node.form) !== definition) node = node.parent;
  }
  if (node === null) {
    throw new Error(
      definition === undefined
        ? "@lunarhue/forms-react: no form.Form is mounted above this component. Render it inside form.Form, or pass the form down as a prop."
        : "@lunarhue/forms-react: no form.Form of this definition is mounted above this component. Forms of other definitions don't count. Render it inside the form.Form of a form made from it.",
    );
  }
  // A form found by its definition is that definition's form. With no definition the caller gets `UnknownForm`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return node.form as never;
};

/**
 * Returns the disabled fields whose errors blocked the last submit that
 * ended invalid, for showing at form level. The adapter takes the list from
 * core's `disabledInvalid()` when the form snapshot's submission becomes
 * `invalid`, whoever started the submit, and empties it when the submission
 * leaves `invalid` (the next submit starts, or the form resets). The list
 * keeps its identity in between. Takes the form or any store, such as
 * `handle.store`.
 */
export type UseDisabledErrors = <E>(
  form: AnyFormStore<E> | { readonly store: AnyFormStore<E> },
) => readonly DisabledInvalid<E>[];

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

/** See `UseDisabledErrors`. */
export const useDisabledErrors: UseDisabledErrors = <E>(form: AnyFormStore<E> | { readonly store: AnyFormStore<E> }) => {
  // The error type only types the list, which comes from this store.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const store = storeOf(form) as AnyFormStore<unknown>;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return useSelected(formSource(store), (snapshot) => disabledFor(store, snapshot)) as readonly DisabledInvalid<E>[];
};
