import type {
  AnyFieldHandle,
  AnyFormStore,
  DefinedValue,
  DisabledInvalid,
  Definition,
  FieldHandle,
  FormDefinition,
  FormError,
  FormsConfig,
  FormStore,
  IntentArgs,
  SchemaAdapter,
  StandardSchemaV1,
  Submission,
} from "@lunarhue/forms-core";
import { notImplemented } from "./not-implemented.js";

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
   * mounted, it is the `<form>` element from `formProps.ref`. Undefined only
   * when no form element is mounted either.
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

/** Settings for `createForms`: core's settings plus the adapter's. */
export interface FormsOptions<A extends readonly SchemaAdapter<never>[] = [], E = FormError> extends FormsConfig<A, E> {
  /** What happens after a submit ends invalid. Defaults to `true`. */
  readonly focusOnInvalid?: FocusOnInvalid<E>;
}

/** Per-form settings for `useForm`. Read on the first render only. */
export interface UseFormOptions<E = FormError> {
  /**
   * The store id, which prefixes every handle id and so every DOM id. Defaults
   * to an id from `useId`, which matches between server and client.
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

/**
 * A form mounted in a component. It is created once per mounted form and
 * keeps its identity, as do all its members. It holds no state: read state
 * with `useField` and `useFormState`.
 */
export interface FormInstance<V, E = FormError, I = undefined, R = unknown> {
  /** The core store. Every handle's `store` is this object. */
  readonly store: FormStore<V, E, I, R>;
  /** The handle for the whole value, the same object as `store.root`. */
  readonly root: FieldHandle<V, E>;
  /** The store id. */
  readonly id: string;
  /**
   * Submits with an intent, as `store.submit` does, then applies
   * `focusOnInvalid` when the submit ends invalid. `store.submit` itself
   * never moves focus.
   */
  readonly submit: (...args: IntentArgs<I>) => Promise<Submission<I, R>>;
  /**
   * As `store.handleSubmit`, then applies `focusOnInvalid` when the submit
   * ends invalid. Bound, like `submit`, so it can be passed on as it is.
   */
  readonly handleSubmit: (event?: { preventDefault(): void }) => Promise<void>;
  /** Spread onto the `<form>` element. */
  readonly formProps: FormElementProps;
}

/** A form instance of any value, error, intent and result type, as context holds it. */
// `any` lets FormInstance of every V, E, I and R fit, whatever their variance.
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyFormInstance = FormInstance<any, any, any, any>;

/** The arguments `useForm` takes: the definition's options unless they are `void`, then per-form settings. */
export type UseFormArgs<O, E> = [O] extends [void]
  ? [instance?: UseFormOptions<E>]
  : [options: O, instance?: UseFormOptions<E>];

/**
 * A form definition for React. It still has core's `createStore`, for tests
 * and code outside components.
 */
export interface ReactFormDefinition<V, E = FormError, I = undefined, R = unknown, O = void>
  extends FormDefinition<V, E, I, R, O> {
  /**
   * Creates the form's store on the first render and returns the same
   * instance on every render after. The store lives in a `useState`
   * initialiser, so it survives re-renders and is dropped with the
   * component. StrictMode may run the initialiser twice and keep one
   * result: creating a store has no side effects, so the other is garbage.
   * `options` and `instance` are read on the first render only.
   */
  useForm(...args: UseFormArgs<O, E>): FormInstance<V, E, I, R>;
  /**
   * Returns the form from the nearest `FormProvider`, typed by this
   * definition. Throws when there is no provider, or when the provided form
   * was made by another definition.
   */
  useFormContext(): FormInstance<V, E, I, R>;
}

/**
 * Defines forms for React. The same three cases as core's `define` decide
 * the value type, and `E`, `I` and `R` are inferred the same way.
 */
export interface Forms<A extends readonly SchemaAdapter<never>[] = [], E = FormError> {
  /** As core's `FormsCore.define`, returning a definition with React hooks. */
  define<V = never, S extends StandardSchemaV1 = never, O = void, I = undefined, R = unknown>(
    config: Definition<V, S, A, E, I, R> | ((options: O) => Definition<V, S, A, E, I, R>),
  ): ReactFormDefinition<DefinedValue<V, S, A>, E, I, R, O>;
}

/**
 * The adapter's entry point. It wraps `createFormsCore` and returns
 * `define`. Call it once at module scope. `E` is inferred from `mapError`.
 */
export type CreateForms = <const A extends readonly SchemaAdapter<never>[] = [], E = FormError>(
  options?: FormsOptions<A, E>,
) => Forms<A, E>;

/**
 * Returns the disabled fields whose errors blocked the last submit that
 * ended invalid, for showing at form level. The adapter takes the list from
 * core's `disabledInvalid()` when the form snapshot's submission becomes
 * `invalid`, whoever started the submit, and empties it when the submission
 * leaves `invalid` (the next submit starts, or the form resets). The list
 * keeps its identity in between. Takes the form instance or any store, such
 * as `handle.store`.
 */
export type UseDisabledErrors = <E>(
  form: AnyFormStore<E> | { readonly store: AnyFormStore<E> },
) => readonly DisabledInvalid<E>[];

/** See `UseDisabledErrors`. Not implemented yet: it throws. */
export const useDisabledErrors: UseDisabledErrors = notImplemented("useDisabledErrors");

/** See `CreateForms`. Not implemented yet: it throws. */
export const createForms: CreateForms = notImplemented("createForms");
