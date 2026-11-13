import type { AnyFieldHandle, DisabledInvalid, FormStore, IntentArgs, Submission } from "@lunarhue/forms-core";
import type { Accessor } from "solid-js";
import { notImplemented } from "./not-implemented.js";

/** What a submit that ended invalid found, as `onInvalid` gets it. */
export interface InvalidSubmit<E> {
  /** `store.firstInvalid()`: the first enabled field with a validation error, if any. */
  readonly field: AnyFieldHandle<E> | undefined;
  /** `store.disabledInvalid()`: the disabled fields with validation errors, which still block submit. */
  readonly disabled: readonly DisabledInvalid<E>[];
  /** The element focus moved to, or `undefined` when `focus` is off or nothing could take it. */
  readonly focused: HTMLElement | undefined;
}

/** Options for `createSubmit`. */
export interface SubmitOptions<E> {
  /** Move focus after a submit that ends invalid. Defaults to true. */
  readonly focus?: boolean;
  /** Runs after a submit that ends invalid, once focus has moved. */
  readonly onInvalid?: (invalid: InvalidSubmit<E>) => void;
}

/** The props to spread on the `<form>` element. */
export interface FormElementProps {
  /** Registers the form element, which takes focus when no field can. */
  readonly ref: (element: HTMLFormElement) => void;
  /** Calls `handleSubmit`. */
  readonly onSubmit: (event: Event) => void;
  /** Turns off the browser's own validation, since the form validates itself. */
  readonly novalidate: true;
}

/**
 * Submits a form and moves focus when the submit ends invalid. After an
 * invalid submit it focuses, in order:
 * 1. the element registered for `store.firstInvalid()`, through the input
 *    props or `fieldRef`, scrolled into view;
 * 2. the form element, when that field has no element, or when
 *    `store.disabledInvalid()` is the only reason the submit failed. The
 *    adapter gives the form `tabindex="-1"` first when it has no tabindex.
 *
 * Errors of disabled fields don't show on their inputs. Render them at form
 * level with `createDisabledErrors`.
 */
export interface SubmitBinding<I, R> {
  /** Spread on the form: `<form {...submit.formProps}>`. */
  readonly formProps: FormElementProps;
  /**
   * Calls `event.preventDefault()`, then submits with an undefined intent as
   * `store.handleSubmit` does, and moves focus when the submit ends invalid.
   * It never rejects.
   */
  handleSubmit(event?: { preventDefault(): void }): Promise<void>;
  /** Submits with an intent, as `store.submit` does, and moves focus when the submit ends invalid. */
  submit(...args: IntentArgs<I>): Promise<Submission<I, R>>;
}

/**
 * Makes the submit wiring for a store. Call it in a component body. The
 * focus targets it uses are the elements registered for this store.
 */
export type CreateSubmit = <V, E, I, R>(store: FormStore<V, E, I, R>, options?: SubmitOptions<E>) => SubmitBinding<I, R>;

/** See `CreateSubmit`. Not implemented yet: it throws. */
export const createSubmit: CreateSubmit = notImplemented("createSubmit");

/**
 * Returns the disabled fields with validation errors, as of the latest
 * submit that ended invalid, for showing at form level. The list is empty
 * until a submit ends invalid, and again once a later submit starts. While
 * the latest submit stays invalid it follows the form snapshot, so fixing or
 * enabling a field takes it off the list.
 */
export type CreateDisabledErrors = <V, E, I, R>(store: FormStore<V, E, I, R>) => Accessor<readonly DisabledInvalid<E>[]>;

/** See `CreateDisabledErrors`. Not implemented yet: it throws. */
export const createDisabledErrors: CreateDisabledErrors = notImplemented("createDisabledErrors");
