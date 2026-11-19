import type { ItemOf, ValueOf } from "@lunarhue/forms-core";
import type { FieldTypes, HandleLike } from "./field.js";
import { createFieldApi } from "./field-api.js";
import { type AnyInputOptions, errorIdOf, type InputField, inputPropsFor } from "./input-props.js";
import { elementRegistrar } from "./refs.js";

/** The input types whose value is a string. */
export type TextInputType =
  | "text"
  | "email"
  | "password"
  | "search"
  | "tel"
  | "url"
  | "hidden"
  | "color"
  | "date"
  | "datetime-local"
  | "month"
  | "time"
  | "week";

/** The input types whose value is a number. */
export type NumberInputType = "number" | "range";

/** Options every kind of input takes. */
export interface InputOptions {
  /** More ids for `aria-describedby`, such as a hint's, placed before the error id. */
  readonly describedBy?: string;
}

/** Options for a text input. `kind` may be left out. */
export interface TextInputOptions extends InputOptions {
  /** Picks the text input props. */
  readonly kind?: "text";
  /** The input's `type`. Defaults to `"text"`. */
  readonly type?: TextInputType;
}

/** Options for a textarea. */
export interface TextareaOptions extends InputOptions {
  /** Picks the textarea props. */
  readonly kind: "textarea";
}

/**
 * Options for a number input. `empty` is what an empty input writes. It
 * defaults to `undefined`, so it is required when the field's type has no
 * `undefined`.
 */
export type NumberInputOptions<V> = InputOptions & {
  /** Picks the number input props. */
  readonly kind: "number";
  /** The input's `type`. Defaults to `"number"`. */
  readonly type?: NumberInputType;
} & (undefined extends V ? { readonly empty?: V } : { readonly empty: V });

/** Options for a checkbox bound to a boolean. */
export interface CheckboxOptions extends InputOptions {
  /** Picks the checkbox props. */
  readonly kind: "checkbox";
}

/** Options for one checkbox of a group bound to an array of strings or numbers. */
export interface CheckboxGroupOptions<T> extends InputOptions {
  /** Picks the checkbox props. */
  readonly kind: "checkbox";
  /** The value this checkbox adds to the array when checked. */
  readonly value: T;
}

/** Options for one radio button. */
export interface RadioOptions<T> extends InputOptions {
  /** Picks the radio props. */
  readonly kind: "radio";
  /** The value this button writes when chosen. */
  readonly value: T;
}

/** Options for a select. */
export interface SelectOptions extends InputOptions {
  /** Picks the select props. */
  readonly kind: "select";
}

/** The props every kind of input gets. */
export interface ControlProps<T extends HTMLElement> {
  /**
   * The handle's id, so a `<label for>` can point at it. A radio or a
   * checkbox of a group gets core's `optionId(handle.id, option)` instead, so
   * each option has its own id.
   */
  readonly id: string;
  /** The snapshot's dotted `name`, such as `rows.0.title`. Reactive. */
  readonly name: string;
  /**
   * Registers the element so a failed submit can focus it. Compose it with
   * your own ref as `ref={[props.ref, mine]}`.
   */
  readonly ref: (element: T) => void;
  /** Marks the field touched and runs blur validation. */
  readonly onBlur: (event: FocusEvent) => void;
  /** The snapshot's `disabled`. Reactive. */
  readonly disabled: boolean;
  /** `"true"` while the field has errors to show, else absent. Reactive. */
  readonly "aria-invalid": "true" | undefined;
  /** `describedBy`, then `errorId(handle)` while the field has errors to show. Absent when both are. Reactive. */
  readonly "aria-describedby": string | undefined;
}

/**
 * The props of a text input. `value` is the field's value, or `""` while it
 * is null or undefined. `onInput` writes `currentTarget.value` as a user edit.
 * The DOM then already holds what the field holds, so when Solid writes
 * `value` back the caret stays where it was.
 */
export interface TextInputProps extends ControlProps<HTMLInputElement> {
  /** The input's type. */
  readonly type: TextInputType;
  /** The field's value. Reactive. */
  readonly value: string;
  /** The snapshot's `readOnly`. Reactive. */
  readonly readonly: boolean;
  /** Writes the input's text to the field. */
  readonly onInput: (event: Event) => void;
}

/** The props of a textarea. Its value and events work as on a text input. */
export interface TextareaProps extends ControlProps<HTMLTextAreaElement> {
  /** The field's value, or `""` while it is null or undefined. Reactive. */
  readonly value: string;
  /** The snapshot's `readOnly`. Reactive. */
  readonly readonly: boolean;
  /** Writes the textarea's text to the field. */
  readonly onInput: (event: Event) => void;
}

/**
 * The props of a number input. `onInput` writes `valueAsNumber`, writes the
 * `empty` option when the input is empty, and writes nothing while the text
 * can't be read as a number, so `1.` or `-` stay as typed. `value` keeps the
 * element's text while it reads as the field's number.
 */
export interface NumberInputProps extends ControlProps<HTMLInputElement> {
  /** The input's type. */
  readonly type: NumberInputType;
  /** The field's number as text, or `""` while it is null or undefined. Reactive. */
  readonly value: string;
  /** The snapshot's `readOnly`. Reactive. */
  readonly readonly: boolean;
  /** Writes the input's number to the field. */
  readonly onInput: (event: Event) => void;
}

/**
 * The props of a checkbox or radio button. HTML has no read-only checkbox,
 * so while the field is read-only `onChange` puts `checked` back and writes
 * nothing, and `aria-readonly` says so.
 */
export interface CheckableProps extends ControlProps<HTMLInputElement> {
  /** The input's type. */
  readonly type: "checkbox" | "radio";
  /** The option's value as text, for radio buttons and checkbox groups. */
  readonly value: string | undefined;
  /** Whether the field holds this option. Reactive. */
  readonly checked: boolean;
  /** `"true"` while the field is read-only, else absent. Reactive. */
  readonly "aria-readonly": "true" | undefined;
  /** Writes the new state to the field. */
  readonly onChange: (event: Event) => void;
}

/** The props of a select. Read-only works as on a checkbox. */
export interface SelectProps extends ControlProps<HTMLSelectElement> {
  /** The field's value, or `""` while it is null or undefined. Reactive. */
  readonly value: string;
  /** `"true"` while the field is read-only, else absent. Reactive. */
  readonly "aria-readonly": "true" | undefined;
  /** Writes the chosen option's value to the field. */
  readonly onChange: (event: Event) => void;
}

/** True when a field of type `V` holds any string and nothing but strings. */
export type IsText<V> = [V] extends [string | null | undefined] ? (string extends V ? true : false) : false;

/** True when a field of type `V` holds any number and nothing but numbers. */
export type IsNumber<V> = [V] extends [number | null | undefined] ? (number extends V ? true : false) : false;

/** True when a field of type `V` holds a boolean and nothing else. */
export type IsBoolean<V> = [V] extends [boolean | null | undefined] ? (boolean extends V ? true : false) : false;

/** True when a field of type `V` holds strings, possibly a union of string literals. */
export type IsChoice<V> = [V] extends [string | null | undefined] ? ([NonNullable<V>] extends [never] ? false : true) : false;

/** True when a field of type `V` holds one primitive a radio button can stand for. */
export type IsOption<V> = [V] extends [string | number | boolean | null | undefined]
  ? [NonNullable<V>] extends [never]
    ? false
    : true
  : false;

/** True when a field of type `V` is an array of strings or numbers. */
export type IsOptionList<V> = [V] extends [readonly (string | number)[] | null | undefined]
  ? [NonNullable<V>] extends [never]
    ? false
    : true
  : false;

/** `unknown` when `Ok` is true, `never` otherwise. Intersected with a parameter, `never` rejects the argument. */
type Allow<Ok extends boolean> = Ok extends true ? unknown : never;

/**
 * Returns the props for an input bound to a field, to spread on the
 * element: `<input {...createInputProps(handle)} />`. Call it in a component
 * body. The value, `name`, flags and aria members are getters over the
 * field's signal, as on `createField`. The handlers are fixed functions, so
 * Solid binds them once.
 *
 * `kind` in the options picks the props, and the field's type decides which
 * kinds it accepts:
 * - `"text"` (the default) and `"textarea"`: a field of `string`, maybe null
 *   or undefined.
 * - `"number"`, with `type: "range"` for a slider: a field of `number`, maybe
 *   null or undefined.
 * - `"checkbox"`: a field of `boolean`, or with `value`, one box of a group
 *   bound to an array of strings or numbers.
 * - `"radio"` with `value`: a field of a string, number or boolean, or a
 *   union of their literals.
 * - `"select"`: a field of a string or a union of string literals. There is
 *   no `<select multiple>`.
 *
 * To run your own handler as well, spread these props, set your own handler
 * after them, and call ours from it.
 */
export interface CreateInputProps {
  <H extends HandleLike>(handle: H & Allow<IsText<ValueOf<H>>>, options?: TextInputOptions): TextInputProps;
  <H extends HandleLike>(handle: H & Allow<IsText<ValueOf<H>>>, options: TextareaOptions): TextareaProps;
  <H extends HandleLike>(handle: H & Allow<IsNumber<ValueOf<H>>>, options: NumberInputOptions<ValueOf<H>>): NumberInputProps;
  <H extends HandleLike>(handle: H & Allow<IsBoolean<ValueOf<H>>>, options: CheckboxOptions): CheckableProps;
  <H extends HandleLike>(
    handle: H & Allow<IsOptionList<ValueOf<H>>>,
    options: CheckboxGroupOptions<ItemOf<ValueOf<H>>>,
  ): CheckableProps;
  <H extends HandleLike>(handle: H & Allow<IsOption<ValueOf<H>>>, options: RadioOptions<NonNullable<ValueOf<H>>>): CheckableProps;
  <H extends HandleLike>(handle: H & Allow<IsChoice<ValueOf<H>>>, options: SelectOptions): SelectProps;
}

function inputPropsOfHandle(handle: HandleLike, options?: AnyInputOptions): unknown {
  // The field object has the members `InputField` names.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return inputPropsFor(createFieldApi(handle) as InputField, options);
}

/** See `CreateInputProps`. */
// The overloads pick the props type from `kind`, which is what `inputPropsFor` builds.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const createInputProps = inputPropsOfHandle as CreateInputProps;

/** What `inputProps` needs from a field object. Every field object fits. */
export interface FieldObjectLike {
  readonly handle: HandleLike;
  readonly text: string;
  /** Type information only. */
  readonly "~field"?: FieldTypes<unknown, unknown>;
}

/** The value type of a field object. */
type FieldValue<F> = F extends { readonly "~field"?: FieldTypes<infer V, unknown> } ? V : never;

/**
 * Returns the props that bind one plain HTML element to a field object:
 * `<input {...inputProps(field)} />`. It is built on the field's pieces
 * (`text`, `setText`, `setNumberText`, `ref`, `handleBlur`) and adds `id`,
 * `name`, `disabled`, `readonly` and the aria members, with the same kinds
 * and checks as `createInputProps`. It returns the same props object for the
 * same field object and options, so it can be called in JSX.
 *
 * A form that never calls it doesn't ship it. A component library's
 * primitives usually own their ids and aria, so bind those with the pieces
 * instead.
 */
export interface InputProps {
  <F extends FieldObjectLike>(field: F & Allow<IsText<FieldValue<F>>>, options?: TextInputOptions): TextInputProps;
  <F extends FieldObjectLike>(field: F & Allow<IsText<FieldValue<F>>>, options: TextareaOptions): TextareaProps;
  <F extends FieldObjectLike>(field: F & Allow<IsNumber<FieldValue<F>>>, options: NumberInputOptions<FieldValue<F>>): NumberInputProps;
  <F extends FieldObjectLike>(field: F & Allow<IsBoolean<FieldValue<F>>>, options: CheckboxOptions): CheckableProps;
  <F extends FieldObjectLike>(
    field: F & Allow<IsOptionList<FieldValue<F>>>,
    options: CheckboxGroupOptions<ItemOf<FieldValue<F>>>,
  ): CheckableProps;
  <F extends FieldObjectLike>(field: F & Allow<IsOption<FieldValue<F>>>, options: RadioOptions<NonNullable<FieldValue<F>>>): CheckableProps;
  <F extends FieldObjectLike>(field: F & Allow<IsChoice<FieldValue<F>>>, options: SelectOptions): SelectProps;
}

/** See `InputProps`. */
// Every field object has the members `InputField` names, and the overloads pick the props type from `kind`.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const inputProps = inputPropsFor as unknown as InputProps;

/**
 * Returns a ref callback that registers an element as the focus target of a
 * field, for custom inputs that don't spread `createInputProps`. Use it as
 * `ref={fieldRef(handle)}`, and call it in a component body: the element is
 * forgotten when that owner is disposed.
 */
export type FieldRef = (handle: HandleLike) => (element: HTMLElement) => void;

/** See `FieldRef`. */
export const fieldRef: FieldRef = (handle) => elementRegistrar(handle);

/**
 * Returns the id the input props point `aria-describedby` at while the field
 * shows errors, core's `errorId(handle.id)`: the handle id with `---error`
 * after it. Put it on the element that renders the errors.
 */
export const errorId: (handle: Pick<HandleLike, "id">) => string = errorIdOf;
