// The ./mini entry: React on core's mini store, for a search box or a login
// form. Every member here is in the main entry with the same name, and a
// form moves to it by changing the import. It never imports core's main
// entry or the adapter's own modules, only their types.
import type { Draft, NamedLeafHandle, Nested, TextControl } from "@lunarhue/forms-core";
import {
  createFormsCore,
  type DefinedValue,
  type Definition,
  type FieldSnapshot,
  type FormDefinition,
  type FormError,
  type FormSnapshot,
  type FormStore,
  type LeafPath,
  type NamedAnyFieldHandle,
  type Part,
  type Parts,
  type StandardSchemaV1,
} from "@lunarhue/forms-core/mini";
import type { ChangeEvent, ReactElement, ReactNode } from "react";
import { useState } from "react";
import { generatedIdUsed, useId, useSyncExternalStore } from "#lunarhue/react";
import type { IsEqual } from "./field.js";
import type { FormElementProps as FullFormElementProps, FormsOptions as FullFormsOptions, UseFormOptions as FullUseFormOptions } from "./forms.js";
import type { TextInputOptions, TextInputProps as FullTextInputProps } from "./input.js";
import type { ValueAt } from "./path.js";
import type { ExactFieldApi as FullExactFieldApi, FieldApi as FullFieldApi } from "./scope.js";

export * from "@lunarhue/forms-core/mini";
export type { IsEqual, TextInputOptions, ValueAt };

/** The members of a mini field object besides its commands. Full's field object has each of them. */
type FieldMembers = "value" | "name" | "errors" | "shownErrors" | "invalid" | "touched" | "id" | "errorId" | "text" | "setText";

/** The commands of a mini field object. Mini binds leaves only, so they are a leaf handle's. */
type CommandMembers = "setValue" | "handleBlur" | "setErrors";

/**
 * One field as a single object, for a field whose value type is exactly
 * `V`: the members of full's `ExactFieldApi` that mini keeps. A new object
 * comes with each new snapshot.
 */
export type ExactFieldApi<V, E = FormError> = Pick<FullExactFieldApi<V, E>, FieldMembers> & Pick<NamedLeafHandle<V, E>, CommandMembers>;

/**
 * The `field` prop of a field component: the members of full's `FieldApi`
 * that mini keeps. A full field object fits it, so a component written
 * for mini keeps working after the move to the full entry.
 */
export type FieldApi<T, P = never, E = FormError> = Pick<FullFieldApi<T, P, E>, FieldMembers | "~fits"> &
  Pick<NamedLeafHandle<Draft<T>, E>, CommandMembers>;

/** Props for the `<form>` element: the members of full's that mini keeps. */
export type FormElementProps = Pick<FullFormElementProps, "id" | "noValidate" | "onSubmit">;

/** Settings for `createForms`: the members of full's that mini keeps. */
export type FormsOptions = Pick<FullFormsOptions, "subscribe">;

/** Per-form settings for `useForm`: the members of full's that mini keeps. */
export type UseFormOptions = Pick<FullUseFormOptions, "id">;

/** Props for `<input>` on a string field: the members of full's that mini keeps. */
export type TextInputProps = Pick<FullTextInputProps, "id" | "name" | "type" | "value" | "onChange" | "onBlur" | "aria-invalid" | "aria-describedby">;

/** What `inputProps` takes: a field object of a string field. */
export type TextFieldLike = Pick<
  FieldApi<string | null | undefined>,
  "value" | "name" | "id" | "errorId" | "shownErrors" | "text" | "setText" | "handleBlur"
>;

/** Props for `form.Form`, where `T` is the form that owns it. */
export interface FormComponentProps<T> {
  /** A function gets the form element props and the form. Plain nodes are rendered as they are. */
  readonly children?: ((formProps: FormElementProps, form: T) => ReactNode) | ReactNode;
}

/** `form.Form`: renders no element, only its children. */
export type FormComponent<T> = (props: FormComponentProps<T>) => ReactElement;

/** Props for `form.Field`. */
export interface FieldProps<V, E, N extends string> {
  /** A dotted name through objects, of a field that isn't an object. */
  readonly name: N;
  readonly children: (field: ExactFieldApi<ValueAt<V, N>, E>) => ReactNode;
}

/** `form.Field`: renders one field by name. */
export type FieldComponent<V, E> = <N extends LeafPath<V>>(props: FieldProps<V, E, N>) => ReactElement;

/** Props for `form.State`, where `T` is the form that owns it. */
export interface FormStateProps<I, R, S, T> {
  /** Picks what to render from the form snapshot. */
  readonly select: (snapshot: FormSnapshot<I, R>) => S;
  /** Accepted for full's signature. Mini renders the children on each new form snapshot. */
  readonly isEqual?: IsEqual<S>;
  /** Renders the selected value. Gets the form too. */
  readonly children: (selected: S, form: T) => ReactNode;
}

/** `form.State`: reads the form snapshot inline. */
export type FormStateComponent<I, R, T> = <S>(props: FormStateProps<I, R, S, T>) => ReactElement;

/** A form mounted in a component. Made once, so every member keeps its identity. */
export interface FormInstance<V, E = FormError, I = undefined, R = unknown> {
  /** The core store. */
  readonly store: FormStore<V, E, I, R>;
  /** The store id. */
  readonly id: string;
  /** The form element props, the same object `form.Form` passes to its child first. */
  readonly formProps: FormElementProps;
  /** Submits. While a submit runs, a second call returns the running one. */
  readonly submit: FormStore<V, E, I, R>["submit"];
  /** Calls `event.preventDefault()`, then submits. Bound. */
  readonly handleSubmit: (event?: { preventDefault(): void }) => Promise<void>;
  readonly Form: FormComponent<FormInstance<V, E, I, R>>;
  readonly Field: FieldComponent<V, E>;
  readonly State: FormStateComponent<I, R, FormInstance<V, E, I, R>>;
}

/** A form definition for React: what `useForm` takes. */
export type ReactFormDefinition<V, E = FormError, I = undefined, R = unknown> = FormDefinition<V, E, I, R>;

/** The form a definition makes: `FormOf<typeof search>`. */
export type FormOf<D> = D extends FormDefinition<infer V, infer E, infer I, infer R> ? FormInstance<V, E, I, R> : never;

/** Parts to pin at a name, as full's fieldsets give them. Mini keeps only `at`. */
export interface Fieldset<V> {
  /** The parts pinned at the dotted name `name`, for `define` to attach: `forms.define(config, Query.at("q"))`. */
  at<K extends string>(name: K): readonly Part<never, Nested<K, V>>[];
}

/** What `createForms` returns. */
export interface Forms<E = FormError> {
  /**
   * Defines a form. Without a schema `defaultValues` sets the value type.
   * With one, any Standard Schema, `defaultValues` is required. Parts after
   * the config attach where their `path` says, as `Query.at("q")` gives.
   */
  define<V = never, S extends StandardSchemaV1 = never, R = unknown>(
    config: Definition<V, S, E, R>,
    ...parts: readonly Parts<NoInfer<DefinedValue<V, S>>>[]
  ): ReactFormDefinition<DefinedValue<V, S>, E, undefined, R>;
  /** Groups parts for a shape `V`, to pin at a field with `at`: `forms.fieldset<string>(trimmed)`. */
  fieldset<V>(...parts: readonly Parts<V>[]): Fieldset<V>;
}

/** Mini's entry point. Call it once at module scope. */
export function createForms(options?: FormsOptions): Forms {
  const { define } = createFormsCore(options);
  return {
    define,
    fieldset: (...parts: readonly Parts<unknown>[]) => ({
      at: (name: string) => parts.flat().map((part) => ({ ...part, path: part.path === undefined ? name : `${name}.${part.path}` })),
    }),
    // The runtime is untyped inside. The types are checked by the type tests.
  } as never;
}

/** A handle as the store makes it, with the members the binding reads. */
interface Handle extends NamedAnyFieldHandle<unknown> {
  readonly "~subscribe": (listener: () => void) => () => void;
  readonly "~text": () => { display(value: unknown): string; afterInput?(input: TextControl, value: unknown, event: object): void } | undefined;
  readonly "~errorId": string;
}

type AnyForm = FormInstance<unknown, unknown, undefined, unknown>;

// The field object for each snapshot.
const fieldApis = new WeakMap<object, unknown>();

/** `null`, `undefined`, `NaN` and objects show as `""`. */
const asText = (value: unknown): string => (value == null || typeof value === "object" || Number.isNaN(value) ? "" : String(value));

function fieldApiOf(handle: Handle, snapshot: FieldSnapshot<unknown, unknown>): unknown {
  let api = fieldApis.get(snapshot);
  if (!api) {
    const display = handle["~text"]();
    api = {
      ...snapshot,
      id: handle.id,
      errorId: handle["~errorId"],
      setValue: handle.setValue,
      handleBlur: handle.handleBlur,
      setErrors: handle.setErrors,
      text: display ? display.display(snapshot.value) : asText(snapshot.value),
      // Writes the text, then lets a display put its text in the element and place the caret.
      setText(text: string, from?: TextControl | { readonly target: EventTarget | null }) {
        handle.setValue(text);
        const control = from && ("setSelectionRange" in from ? from : from.target);
        if (display?.afterInput && control) {
          // A React event has the native one on `nativeEvent`.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          display.afterInput(control as TextControl, handle.peek().value, control === from ? {} : ((from as { nativeEvent?: object }).nativeEvent ?? from));
        }
      },
    };
    fieldApis.set(snapshot, api);
  }
  return api;
}

/** Builds the form object around a new store. */
function makeForm(store: FormStore<unknown, unknown, undefined, unknown>): AnyForm {
  const { handleSubmit } = store;
  const formProps: FormElementProps = {
    id: store.id,
    noValidate: true,
    onSubmit: (event) => {
      void handleSubmit(event);
    },
  };
  // The components run only after `form` below is made.
  function Form({ children }: FormComponentProps<AnyForm>): ReactElement {
    // React renders any node a component returns.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return (typeof children === "function" ? children(formProps, form) : children) as ReactElement;
  }
  function Field({ name, children }: FieldProps<unknown, unknown, string>): ReactElement {
    // The store makes a handle for any path.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const handle = store.fieldAt(store.pathOf(name) ?? []) as Handle;
    const snapshot = useSyncExternalStore(handle["~subscribe"], handle.peek, handle.peek);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return children(fieldApiOf(handle, snapshot) as never) as ReactElement;
  }
  function State({ select, children }: FormStateProps<undefined, unknown, unknown, AnyForm>): ReactElement {
    const snapshot = useSyncExternalStore(store.subscribeForm, store.getFormSnapshot, store.getServerFormSnapshot);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return children(select(snapshot), form) as ReactElement;
  }
  const form: AnyForm = { store, id: store.id, formProps, submit: store.submit, handleSubmit, Form, Field: Field as never, State: State as never };
  return form;
}

/**
 * Makes the form on the first render and returns the same object on every
 * render after. The id defaults to one from `useId`, which matches between
 * server and client on React 18 and later.
 */
export function useForm<V, E, I, R>(definition: ReactFormDefinition<V, E, I, R>, instance?: UseFormOptions): FormInstance<V, E, I, R> {
  const generatedId = useId();
  const [form] = useState(() => {
    const id = instance?.id;
    if (id === undefined) generatedIdUsed();
    // The store's types follow the definition's.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return makeForm(definition.createStore(undefined, { id: id ?? generatedId }) as FormStore<unknown, unknown, undefined, unknown>);
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return form as unknown as FormInstance<V, E, I, R>;
}

/**
 * Returns the props for an `<input>` on a string field:
 * `<input {...inputProps(field)} />`. `value` is `field.text`, and
 * `onChange` writes through `field.setText`. Errors show in `aria-invalid`
 * and `aria-describedby` only while they are in `shownErrors`.
 */
export function inputProps(field: TextFieldLike, options?: TextInputOptions): TextInputProps {
  // An ARIA state that is off is left out. React would write `false` as "false".
  const shown = field.shownErrors.length > 0 || undefined;
  return {
    id: field.id,
    name: field.name,
    type: options?.type ?? "text",
    value: field.text,
    onChange: (event: ChangeEvent<HTMLInputElement>) => field.setText(event.target.value, event),
    onBlur: field.handleBlur,
    "aria-invalid": shown,
    "aria-describedby": shown && field.errorId,
  };
}
