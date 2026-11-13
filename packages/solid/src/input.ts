import type { ItemOf, ValueOf } from "@lunarhue/forms-core";
import type { HandleLike } from "./field.js";
import { notImplemented } from "./not-implemented.js";

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
  /** The handle's id, so a `<label for>` can point at it. */
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

/** The arguments of an overload: `Args` when `Ok` is true, else one `never`, which no call can pass. */
type ArgsIf<Ok extends boolean, Args extends readonly unknown[]> = Ok extends true ? Args : [never];

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

/** See `CreateInputProps`. Not implemented yet: it throws. */
export const createInputProps: CreateInputProps = notImplemented("createInputProps");

/**
 * `createInputProps` for one field whose value type `V` is known: the same
 * kinds and the same checks, without the handle argument. A kind the field
 * doesn't fit takes no call.
 */
export interface InputPropsOf<V> {
  (...args: ArgsIf<IsText<V>, [options?: TextInputOptions]>): TextInputProps;
  (...args: ArgsIf<IsText<V>, [options: TextareaOptions]>): TextareaProps;
  (...args: ArgsIf<IsNumber<V>, [options: NumberInputOptions<V>]>): NumberInputProps;
  (...args: ArgsIf<IsBoolean<V>, [options: CheckboxOptions]>): CheckableProps;
  (...args: ArgsIf<IsOptionList<V>, [options: CheckboxGroupOptions<ItemOf<V>>]>): CheckableProps;
  (...args: ArgsIf<IsOption<V>, [options: RadioOptions<NonNullable<V>>]>): CheckableProps;
  (...args: ArgsIf<IsChoice<V>, [options: SelectOptions]>): SelectProps;
}

/**
 * Returns a ref callback that registers an element as the focus target of a
 * field, for custom inputs that don't spread `createInputProps`. Use it as
 * `ref={fieldRef(handle)}`, and call it in a component body: the element is
 * forgotten when that owner is disposed.
 */
export type FieldRef = (handle: HandleLike) => (element: HTMLElement) => void;

/** See `FieldRef`. Not implemented yet: it throws. */
export const fieldRef: FieldRef = notImplemented("fieldRef");

/**
 * Returns the id the input props point `aria-describedby` at while the field
 * shows errors. Put it on the element that renders the errors.
 */
export function errorId(handle: Pick<HandleLike, "id">): string {
  return `${handle.id}-errors`;
}
