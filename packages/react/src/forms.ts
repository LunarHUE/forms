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
import { type Context, createContext, createElement, type ReactElement, type ReactNode, useContext, useId, useState } from "react";
import { type AnyScope, makeScope } from "./bound.js";
import type { HandleLike } from "./field.js";
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
export type ReservedName = "Field" | "Items" | "Form" | "store" | "root" | "id" | "formProps" | "submit" | "handleSubmit";

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

/** Per-form settings for `useForm`. Read on the first render only. */
export interface UseFormOptions<E = FormError> {
  /**
   * The store id, which prefixes every handle id and so every DOM id.
   * Defaults to an id from `useId`, which matches between server and client.
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
   * `<form onSubmit>` in the React 18 and 19 types alike.
   */
  readonly onSubmit: (event: { preventDefault(): void }) => void;
  /** Records the form element as the focus fallback. Same cleanup rules as `FieldRef`. */
  readonly ref: (element: HTMLFormElement | null) => (() => void) | undefined;
}

/** What `form.Form` passes to a function child: the form element props and `submit`. */
export interface FormRenderProps<I, R> extends FormElementProps {
  /** The form's `submit`, for buttons that submit with an intent. */
  readonly submit: (...args: IntentArgs<I>) => Promise<Submission<I, R>>;
}

/** Props for `form.Form`. */
export interface FormComponentProps<I, R> {
  /**
   * A function gets the form element props and `submit`, to spread on a real
   * `<form>`. Plain nodes are rendered as they are, with the context only.
   */
  readonly children?: ((props: FormRenderProps<I, R>) => ReactNode) | ReactNode;
}

/**
 * `form.Form`: renders no element. It provides the form to everything
 * below, for `useFormContext` and the definition's `useFormContext`.
 */
export type FormComponent<I, R> = (props: FormComponentProps<I, R>) => ReactElement;

/** The form's own members, on top of the scope at its root. */
export interface FormMembers<V, E, I, R> {
  /** The core store. Every handle's `store` is this object. */
  readonly store: FormStore<V, E, I, R>;
  /** The store id. */
  readonly id: string;
  /** The form element props, the same object `form.Form` passes to its child without `submit`. */
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
  readonly Form: FormComponent<I, R>;
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
> = Scope<V, E, F> & FormMembers<V, E, I, R>;

/** A form of unknown value, error, intent and result type, as the generic context reader returns it. */
export type UnknownForm = FormInstance<unknown, unknown, unknown>;

/** The arguments `useForm` takes: the definition's options unless they are `void`, then per-form settings. */
export type UseFormArgs<O, E> = [O] extends [void]
  ? [instance?: UseFormOptions<E>]
  : [options: O, instance?: UseFormOptions<E>];

/** A form definition for React. It still has core's `createStore`, for tests and code outside components. */
export interface ReactFormDefinition<
  V,
  E = FormError,
  I = undefined,
  R = unknown,
  O = void,
  F extends FieldComponentMap = NoFields,
> extends FormDefinition<V, E, I, R, O> {
  /**
   * Makes the form on the first render and returns the same object on every
   * render after. The store and the bound components are made in a
   * `useState` initialiser, so they survive re-renders and are dropped with
   * the component. StrictMode may run the initialiser twice and keep one
   * result. Making a store has no side effects, so the other is garbage.
   * `options` and `instance` are read on the first render only.
   */
  useForm(...args: UseFormArgs<O, E>): FormInstance<V, E, I, R, F>;
  /**
   * Returns the form of this definition from the nearest `form.Form` that
   * provides one, skipping forms of other definitions nearer to it. Throws
   * when there is none.
   */
  useFormContext(): FormInstance<V, E, I, R, F>;
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
   * As core's `FormsCore.define`, returning a definition with React hooks.
   * The same three cases decide the value type, and `E`, `I` and `R` are
   * inferred the same way.
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

/** The context every `form.Form` provides, whatever its definition. */
const SharedContext = createContext<AnyForm | null>(null);

/** Returns the form a context holds, or throws when no `form.Form` is above. */
function useProvidedForm(context: Context<AnyForm | null>): AnyForm {
  const form = useContext(context);
  if (form === null) {
    throw new Error(
      "@lunarhue/forms-react: no form.Form is mounted above this component. Render it inside form.Form, or pass the form down as a prop.",
    );
  }
  return form;
}

/** Makes a form on the first render and returns the same one after. */
function useNewForm(make: (generatedId: string) => AnyForm): AnyForm {
  const generatedId = useId();
  const [form] = useState(() => make(generatedId));
  return form;
}

/** Builds the form object around a new store. */
function makeForm(store: AnyFormStore<unknown>, scope: AnyScope, own: Context<AnyForm | null>, focus: FocusOnInvalid<unknown>): AnyForm {
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
  const renderProps = { ...formProps, submit };
  // `Form` only runs after `form` below is made.
  function Form(props: FormComponentProps<unknown, unknown>): ReactElement {
    const { children } = props;
    const content = typeof children === "function" ? children(renderProps) : children;
    return createElement(SharedContext.Provider, { value: form }, createElement(own.Provider, { value: form }, content));
  }
  const form: AnyForm = { ...scope, store, id: store.id, formProps, submit, handleSubmit, Form };
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
    const definition = core.define(config);
    const own = createContext<AnyForm | null>(null);
    const takesOptions = typeof config === "function";
    const createForm = (args: readonly unknown[], generatedId: string): AnyForm => {
      // `useForm` takes the definition's options first only when the definition is a function.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const instance = (takesOptions ? args[1] : args[0]) as UseFormOptions<unknown> | undefined;
      const store = definition.createStore(takesOptions ? args[0] : undefined, { id: instance?.id ?? generatedId });
      return makeForm(store, scope(store.root), own, instance?.focusOnInvalid ?? defaultFocus);
    };
    return {
      createStore: (storeOptions: unknown, instance: StoreInstance = {}) => definition.createStore(storeOptions, instance),
      useForm: (...args: unknown[]) => useNewForm((generatedId) => createForm(args, generatedId)),
      useFormContext: () => useProvidedForm(own),
    };
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { define, scope, fieldset: () => ({ scope }) } as never;
};

/**
 * Returns the form from the nearest `form.Form`, whatever its definition.
 * Throws when there is none. Enough for `submit`, `formProps`,
 * `useFormState` and handle props. The definition's own `useFormContext`
 * returns it typed.
 */
export type UseFormContext = () => UnknownForm;

/** See `UseFormContext`. */
export const useFormContext: UseFormContext = () =>
  // The shared context holds forms of every definition, which `UnknownForm` covers.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  useProvidedForm(SharedContext) as unknown as UnknownForm;

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
