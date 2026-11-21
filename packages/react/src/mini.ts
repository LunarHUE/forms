// The ./mini entry: React on core's mini store, for a search box or a login
// form. Every member here is in the main entry with the same name, and a
// form moves to it by changing the import. It never imports core's main
// entry or the adapter's own modules, only their types.
import type { Draft, ErrorOf, NamedLeafHandle, Nested, PluginsOf, TextControl } from "@lunarhue/forms-core";
import {
  createFormsCore,
  type DefinedValue,
  type DefineConfig,
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
import type { ChangeEvent, ComponentType, JSXElementConstructor, ReactElement, ReactNode } from "react";
import { createElement, useState } from "react";
import { generatedIdUsed, useId, useSyncExternalStore } from "#lunarhue/react";
import type { IsEqual } from "./field.js";
import type {
  CheckedFields,
  FormElementProps as FullFormElementProps,
  FormsOptions as FullFormsOptions,
  UseFormOptions as FullUseFormOptions,
} from "./forms.js";
import type { TextInputOptions, TextInputProps as FullTextInputProps } from "./input.js";
import type { ValueAt } from "./path.js";
import type {
  AcceptedValues,
  ExactFieldApi as FullExactFieldApi,
  FieldApi as FullFieldApi,
  FieldPropOf,
  NameFitting,
  NoFields,
  OwnPropsOf,
} from "./scope.js";

export * from "@lunarhue/forms-core/mini";
export type { IsEqual, NoFields, OwnPropsOf, TextInputOptions, ValueAt };

/** The members of a mini field object besides its commands. Full's field object has each of them. */
type FieldMembers = "value" | "name" | "errors" | "shownErrors" | "invalid" | "touched" | "id" | "errorId" | "text" | "setText" | "~types";

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

/**
 * The app's field components by the name they get on every form. Mini takes
 * plain components only. A `defineField(...)` entry needs the full entry.
 */
export type FieldComponentMap = Readonly<Record<string, JSXElementConstructor<never>>>;

/**
 * Full's checks on `fields`, plus one of mini's own: a component whose
 * `field` prop asks for a member mini's field object lacks, as full's
 * `FieldApi` does, becomes `never`.
 */
type MiniCheckedFields<F extends FieldComponentMap> = {
  readonly [K in keyof F]: [Exclude<keyof FieldPropOf<F[K]>, keyof FieldApi<unknown>>] extends [never] ? CheckedFields<F>[K] : never;
};

/** Settings for `createForms`: the members of full's that mini keeps. */
export interface FormsOptions<F extends FieldComponentMap = NoFields> extends Pick<FullFormsOptions, "subscribe"> {
  /**
   * The app's field components. Each is an ordinary component with a
   * `field: FieldApi<T>` prop and any props of its own, and shows up bound,
   * under the same name, on every form: `<form.TextField name="email" label="Email" />`.
   */
  readonly fields?: F & MiniCheckedFields<F>;
}

/** Per-form settings for `useForm`: the members of full's that mini keeps. */
export type UseFormOptions = Pick<FullUseFormOptions, "id">;

/**
 * The arguments `useForm` takes after the definition, as full's: the
 * definition's options unless they are `void`, then per-form settings.
 */
type UseFormArgs<O> = [O] extends [void] ? [instance?: UseFormOptions] : [options: O, instance?: UseFormOptions];

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
export interface FieldComponent<in out V, in out E> {
  <N extends LeafPath<V>>(props: FieldProps<V, E, N>): ReactElement;
}

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

/**
 * A registered component bound to a form. It takes the component's own props
 * and the `name` of a field that fits it and isn't an object, then renders
 * the component with `field` filled in. `name` never reaches the component.
 */
export type BoundFieldComponent<V, E, A, O> = (props: O & { readonly name: LeafPath<V> & NameFitting<V, E, A> }) => ReactElement;

/**
 * The registered components as bound on a form. A component whose field
 * error type doesn't accept the form's, or whose field names plugins, is
 * `never` there.
 */
type BoundFieldComponents<V, E, F extends FieldComponentMap> = {
  readonly [K in keyof F]: [E] extends [ErrorOf<FieldPropOf<F[K]>>]
    ? [PluginsOf<FieldPropOf<F[K]>>] extends [never]
      ? BoundFieldComponent<V, E, AcceptedValues<FieldPropOf<F[K]>>, OwnPropsOf<F[K]>>
      : never
    : never;
};

/** The form's own members, besides the registered components. */
export interface FormMembers<V, E, I, R, F extends FieldComponentMap = NoFields> {
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
  readonly Form: FormComponent<FormInstance<V, E, I, R, F>>;
  readonly Field: FieldComponent<V, E>;
  readonly State: FormStateComponent<I, R, FormInstance<V, E, I, R, F>>;
}

/** A form mounted in a component. Made once, so every member keeps its identity. */
export type FormInstance<V, E = FormError, I = undefined, R = unknown, F extends FieldComponentMap = NoFields> = FormMembers<V, E, I, R, F> &
  BoundFieldComponents<V, E, F>;

/**
 * A form definition for React: what `useForm` takes. `O` is what the
 * function form of `define` takes, and `void` for a plain config. It keeps
 * full's parameter order, so an annotation keeps working after the move to
 * the full entry.
 */
export interface ReactFormDefinition<V, E = FormError, I = undefined, R = unknown, O = void, F extends FieldComponentMap = NoFields>
  extends FormDefinition<V, E, I, R, O> {
  /** Type information only: the form `useForm` makes from this definition. */
  readonly "~form"?: FormInstance<V, E, I, R, F>;
}

/** The form a definition makes: `FormOf<typeof search>`. */
export type FormOf<D> = D extends { readonly "~form"?: infer T } ? T : never;

/** Parts to pin at a name, as full's fieldsets give them. Mini keeps only `at`. */
export interface Fieldset<V> {
  /** The parts pinned at the dotted name `name`, for `define` to attach: `forms.define(config, Query.at("q"))`. */
  at<K extends string>(name: K): readonly Part<never, Nested<K, V>>[];
}

/** What `createForms` returns. */
export interface Forms<E = FormError, F extends FieldComponentMap = NoFields> {
  /**
   * Defines a form. Without a schema `defaultValues` sets the value type.
   * With one, any Standard Schema, `defaultValues` is required. The config
   * can be a function of per-form options, `define((options: O) => config)`,
   * and `useForm(definition, options)` then passes them. Parts after the
   * config attach where their `path` says, as `Query.at("q")` gives.
   */
  define<V = never, S extends StandardSchemaV1 = never, O = void, R = unknown>(
    config: DefineConfig<V, S, O, E, R>,
    ...parts: readonly Parts<NoInfer<DefinedValue<V, S>>>[]
  ): ReactFormDefinition<DefinedValue<V, S>, E, undefined, R, O, F>;
  /** Groups parts for a shape `V`, to pin at a field with `at`: `forms.fieldset<string>(trimmed)`. */
  fieldset<V>(...parts: readonly Parts<V>[]): Fieldset<V>;
}

/** Mini's entry point. Call it once at module scope. `F` is inferred from `fields`. */
export function createForms<F extends FieldComponentMap = NoFields>(options?: FormsOptions<F>): Forms<FormError, F> {
  // Core's `define` is an arrow function.
  // oxlint-disable-next-line typescript/unbound-method
  const { define } = createFormsCore(options);
  // The runtime is untyped inside. The type tests check the types.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return {
    // `useForm` reads the components from the definition, and takes options first when the config is a function.
    define: (...args: Parameters<typeof define>) => ({ ...define(...args), "~fields": options?.fields, "~options": typeof args[0] === "function" }),
    fieldset: (...parts: readonly Parts<unknown>[]) => ({
      at: (name: string) => parts.flat().map((part) => ({ ...part, path: part.path === undefined ? name : `${name}.${part.path}` })),
    }),
  } as never;
}

/** A handle as the store makes it, with the members the binding reads. */
interface Handle extends NamedAnyFieldHandle<unknown> {
  readonly "~subscribe": (listener: () => void) => () => void;
  readonly "~text": () => { display(value: unknown): string; afterInput?(input: TextControl, value: unknown, event: object): void } | undefined;
  readonly "~errorId": string;
}

type AnyForm = FormInstance<unknown, unknown>;

// The field object for each snapshot.
const fieldApis = new WeakMap<object, unknown>();

/** `null`, `undefined`, `NaN` and objects show as `""`. */
// What reaches `String` is a primitive.
// oxlint-disable-next-line typescript/no-base-to-string
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
// The store's members are arrow functions, so they need no `this`.
// oxlint-disable typescript/unbound-method
function makeForm(store: FormStore<unknown, unknown>, fields: FieldComponentMap | undefined): AnyForm {
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
  /** The field object of the field at a dotted name, re-read on each new snapshot. */
  function useFieldApi(name: string): never {
    // The store makes a handle for any path.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const handle = store.fieldAt(store.pathOf(name) ?? []) as Handle;
    const snapshot = useSyncExternalStore(handle["~subscribe"], handle.peek, handle.peek);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return fieldApiOf(handle, snapshot) as never;
  }
  function Field({ name, children }: FieldProps<unknown, unknown, string>): ReactElement {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return children(useFieldApi(name)) as ReactElement;
  }
  const registered: Record<string, unknown> = {};
  for (const key in fields) {
    // The props pass through as they came, and the types of `fields` checked them.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const component = fields[key] as ComponentType<Record<string, unknown>>;
    /** Renders the registered component with its `field` filled in. */
    function Bound({ name, ...own }: { readonly name: string }): ReactElement {
      return createElement(component, { ...own, field: useFieldApi(name) });
    }
    registered[key] = Bound;
  }
  function State({ select, children }: FormStateProps<undefined, unknown, unknown, AnyForm>): ReactElement {
    const snapshot = useSyncExternalStore(store.subscribeForm, store.getFormSnapshot, store.getServerFormSnapshot);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return children(select(snapshot), form) as ReactElement;
  }
  // The generic component types are the public ones. The runtime takes any name and selector.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const form: AnyForm = { ...registered, store, id: store.id, formProps, submit: store.submit, handleSubmit, Form, Field: Field as never, State: State as never };
  return form;
}
// oxlint-enable typescript/unbound-method

/**
 * Makes the form on the first render and returns the same object on every
 * render after. `options` is required when the definition was made with the
 * function form of `define`, and absent otherwise. `options` and `instance`
 * are read on the first render only. The id defaults to one from `useId`,
 * which matches between server and client on React 18 and later.
 */
export function useForm<V, E, I, R, O, F extends FieldComponentMap>(
  definition: ReactFormDefinition<V, E, I, R, O, F>,
  ...args: UseFormArgs<NoInfer<O>>
): FormInstance<V, E, I, R, F> {
  const generatedId = useId();
  const [form] = useState(() => {
    // `createForms` marks each definition with its components and whether its config is a function.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const { "~fields": fields, "~options": takesOptions } = definition as { readonly "~fields"?: FieldComponentMap; readonly "~options"?: boolean };
    // A plain config ignores the options, so the first argument goes to the store either way.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const id = (args[takesOptions ? 1 : 0] as UseFormOptions | undefined)?.id;
    if (id === undefined) generatedIdUsed();
    // The store's types follow the definition's.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return makeForm(definition.createStore(args[0] as O, { id: id ?? generatedId }) as FormStore<unknown, unknown>, fields);
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return form as unknown as FormInstance<V, E, I, R, F>;
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
