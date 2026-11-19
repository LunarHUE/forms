import { errorId as coreErrorId, type FieldSnapshot, type HandleTypes, type ItemOf, type ShapeOf, type ValueOf } from "@lunarhue/forms-core";
import type { ChangeEvent } from "react";
import { fieldViewSource } from "./field-api.js";
import { type HandleLike, whole } from "./field.js";
import { type AnyInputOptions, type InputState, inputPropsFor } from "./input-props.js";
import type { FieldPieces } from "./pieces.js";
import { refFor } from "./refs.js";
import { useSelected } from "./select.js";

/**
 * The ref callback the adapter puts on a field's element. It records the
 * element for focus after an invalid submit. On a native input, textarea or
 * select that the browser filled back in before hydration, it puts back
 * what React rendered. On React 19 it returns the
 * cleanup that forgets it. Earlier versions get no cleanup, since React 18.3
 * warns about one, and call the callback again with `null`, which does
 * nothing: an element that left the document is skipped by focus and dropped
 * the next time an element is recorded.
 */
export type FieldRef = (element: HTMLElement | null) => (() => void) | undefined;

/** The props every input kind gets. */
export interface BaseInputProps {
  /** The field's dotted name from its snapshot, such as `rows.0.title`. */
  readonly name: string;
  /**
   * The handle's id, for `<label htmlFor>`. A radio or a checkbox of a group
   * gets core's `optionId(handle.id, option)` instead, so each option has its
   * own id.
   */
  readonly id: string;
  /** Marks the field touched and runs blur validation. */
  readonly onBlur: () => void;
  /** Records the element for focus. See `FieldRef`. */
  readonly ref: FieldRef;
  /** The snapshot's `disabled`. */
  readonly disabled: boolean;
  /** True while the field has errors in `shownErrors`, else undefined. */
  readonly "aria-invalid": true | undefined;
  /** `errorId(handle)` while the field has errors in `shownErrors`, else undefined. */
  readonly "aria-describedby": string | undefined;
}

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

/** Props for `<input>` on a string field. */
export interface TextInputProps extends BaseInputProps {
  /** The option's `type`, `"text"` when left out. */
  readonly type: TextInputType;
  /** The value, with `null` and `undefined` shown as `""`. */
  readonly value: string;
  /** The snapshot's `readOnly`. */
  readonly readOnly: boolean;
  /** Writes the element's value as a user edit. */
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/** Props for `<textarea>` on a string field. They are the text input's without `type`. */
export interface TextareaProps extends BaseInputProps {
  /** The value, with `null` and `undefined` shown as `""`. */
  readonly value: string;
  /** The snapshot's `readOnly`. */
  readonly readOnly: boolean;
  /** Writes the element's value as a user edit. */
  readonly onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

/** Props for `<input type="number">` and `<input type="range">`. */
export interface NumberInputProps extends BaseInputProps {
  /** The option's `kind`. */
  readonly type: "number" | "range";
  /** The number as text, with `null`, `undefined` and `NaN` shown as `""`. */
  readonly value: string;
  /** The snapshot's `readOnly`. */
  readonly readOnly: boolean;
  /** Writes `valueAsNumber`, or the `empty` option when the input is empty. */
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Props for `<input type="checkbox">`. Browsers ignore `readOnly` on
 * checkboxes, so it is `aria-readonly` here and `onChange` writes nothing
 * while the field is read-only. The same holds for radios and selects.
 */
export interface CheckboxInputProps extends BaseInputProps {
  readonly type: "checkbox";
  /** On a boolean field, the value. On a group, whether the array holds this box's option. */
  readonly checked: boolean;
  /** True while the snapshot is `readOnly`, else undefined. */
  readonly "aria-readonly": true | undefined;
  /** On a boolean field, writes `checked`. On a group, adds or removes the option. */
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/** Props for one checkbox of a group over an array field. */
export interface CheckboxGroupInputProps extends CheckboxInputProps {
  /** `String(option)`. */
  readonly value: string;
}

/** Props for one `<input type="radio">` of a group. Every radio of a field shares `name`. */
export interface RadioInputProps extends BaseInputProps {
  readonly type: "radio";
  /** `String(option)`. */
  readonly value: string;
  /** True when the field's value is this option. */
  readonly checked: boolean;
  /** True while the snapshot is `readOnly`, else undefined. */
  readonly "aria-readonly": true | undefined;
  /** Writes this option as a user edit, unless the field is read-only. */
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/** Props for a single `<select>`. `<select multiple>` is not covered. */
export interface SelectProps extends BaseInputProps {
  /** The value, with `null` and `undefined` shown as `""`. */
  readonly value: string;
  /** True while the snapshot is `readOnly`, else undefined. */
  readonly "aria-readonly": true | undefined;
  /** Writes the chosen option's value, or `empty` for an option whose value is `""`. */
  readonly onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}

/**
 * The `empty` option of number and select inputs: the value an empty input
 * writes. It defaults to `undefined`, so it is required when the field's
 * type has no `undefined`.
 */
export type EmptyOption<V> = undefined extends V ? { readonly empty?: V } : { readonly empty: V };

/** Options for a text input. `kind` defaults to `"text"`. */
export interface TextInputOptions {
  readonly kind?: "text";
  /** The input's `type`. Defaults to `"text"`. */
  readonly type?: TextInputType;
}

/** Options for a textarea. */
export interface TextareaOptions {
  readonly kind: "textarea";
}

/** Options for a number or range input. */
export type NumberInputOptions<V> = { readonly kind: "number" | "range" } & EmptyOption<V>;

/** Options for a checkbox on a boolean field. */
export interface CheckboxInputOptions {
  readonly kind: "checkbox";
}

/** Options for one checkbox of a group over an array of strings or numbers. `value` is this box's option. */
export interface CheckboxGroupOptions<T> {
  readonly kind: "checkbox";
  readonly value: T;
}

/** Options for one radio. `value` is the option this radio writes. */
export interface RadioInputOptions<V> {
  readonly kind: "radio";
  readonly value: NonNullable<V>;
}

/** Options for a select. */
export type SelectOptions<V> = { readonly kind: "select" } & EmptyOption<V>;

/** True when every member of `V` is one of `T`, `null` or `undefined`. */
type Only<V, T> = [V] extends [T | null | undefined] ? true : false;

/**
 * The input options a field of value type `V` accepts. Text and select need
 * a string field, number and range a number field, a plain checkbox a
 * boolean field, a radio a string, number or boolean field, and a checkbox
 * with `value` an array of strings or numbers. Other fields accept none.
 */
export type InputOptionsFor<V> =
  | (Only<V, string> extends true ? TextInputOptions | TextareaOptions | SelectOptions<V> : never)
  | (Only<V, number> extends true ? NumberInputOptions<V> : never)
  | (Only<V, boolean> extends true ? CheckboxInputOptions : never)
  | (Only<V, string | number | boolean> extends true ? RadioInputOptions<V> : never)
  | (ShapeOf<V> extends "array" ? (Only<ItemOf<V>, string | number> extends true ? CheckboxGroupOptions<ItemOf<V>> : never) : never);

/** The props an options object gives. */
export type InputPropsFor<O> = O extends { readonly kind: "number" | "range" }
  ? NumberInputProps
  : O extends { readonly kind: "checkbox"; readonly value: unknown }
    ? CheckboxGroupInputProps
    : O extends { readonly kind: "checkbox" }
      ? CheckboxInputProps
      : O extends { readonly kind: "radio" }
        ? RadioInputProps
        : O extends { readonly kind: "select" }
          ? SelectProps
          : O extends { readonly kind: "textarea" }
            ? TextareaProps
            : TextInputProps;

/**
 * The rest argument of a call with no options: empty when the field takes a
 * text input, and an impossible argument otherwise, so the call fails.
 */
export type NoOptionsArgs<V> = TextInputOptions extends InputOptionsFor<V> ? [] : [options: never];

/** What `useInputProps` needs from a handle. */
export interface InputHandleLike extends HandleLike {
  /** Writes the value. */
  readonly setValue: unknown;
}

/**
 * Returns the props that bind one element to a field. The options are
 * checked against the field's value type, see `InputOptionsFor`. Errors show
 * in `aria-invalid` and `aria-describedby` only while they are in
 * `shownErrors`. The callbacks keep their identity for the life of the
 * handle. The props object changes only when the field's snapshot does.
 */
export const useInputProps: {
  <H extends InputHandleLike, const O extends InputOptionsFor<ValueOf<H>>>(handle: H, options: O): InputPropsFor<O>;
  <H extends InputHandleLike>(handle: H, ...options: NoOptionsArgs<ValueOf<H>>): TextInputProps;
} = (handle: InputHandleLike, options?: AnyInputOptions) => {
  // The field object changes when the snapshot or the typed number text does.
  const { api } = useSelected(fieldViewSource(handle), whole);
  // The field object has the pieces, and the props match the options by kind,
  // which the overloads check against the value type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return inputPropsFor(handle, api as unknown as InputState, options) as never;
};

/** What `inputProps` needs from a field object: its handle, snapshot members and pieces. Every field object fits. */
export interface FieldObjectLike extends FieldSnapshot<unknown, unknown>, Omit<FieldPieces, "setNumberText"> {
  readonly handle: { readonly id: string };
  readonly text: string;
  /** See `FieldPieces.setNumberText`. A method, so a field of any value type fits. */
  setNumberText(text: string, empty?: never): void;
  /** Type information only. */
  readonly "~types"?: HandleTypes<unknown, unknown>;
}

/**
 * Returns the props that bind one plain HTML element to a field object:
 * `<input {...inputProps(field)} />`. It is built on the field's pieces
 * (`text`, `setText`, `setNumberText`, `ref`, `handleBlur`) and adds `name`,
 * `id`, `disabled`, `readOnly` and the aria members. The options are checked
 * against the field's value type, see `InputOptionsFor`. Errors show in
 * `aria-invalid` and `aria-describedby` only while they are in
 * `shownErrors`. The callbacks keep their identity for the life of the
 * handle, and the props object changes only when the field object does.
 *
 * It is a plain function, not a hook, so it can be called anywhere the field
 * object is, and a form that never calls it doesn't ship it. A component
 * library's primitives usually own their ids and aria, so bind those with the
 * pieces instead.
 */
export const inputProps: {
  <F extends FieldObjectLike, const O extends InputOptionsFor<ValueOf<F>>>(field: F, options: O): InputPropsFor<O>;
  <F extends FieldObjectLike>(field: F, ...options: NoOptionsArgs<ValueOf<F>>): TextInputProps;
} = (field: FieldObjectLike, options?: AnyInputOptions) =>
  // `setNumberText` takes the field's own value type, and the props match the
  // options by kind, which the overloads check against the value type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  inputPropsFor(field.handle, field as InputState, options) as never;

/**
 * Returns a ref callback that records an element for a field, for custom
 * inputs that don't use `useInputProps`. The callback keeps its identity for
 * the life of the handle.
 */
// It reads no state, so it is a plain lookup.
export const useFieldRef = (handle: HandleLike): FieldRef => refFor(handle);

/**
 * The id of the element that shows a field's errors, core's
 * `errorId(handle.id)`: the handle id with `---error` after it. It never
 * names a field or an option. Input props point `aria-describedby` at it.
 */
export const errorId = (handle: { readonly id: string }): string => coreErrorId(handle.id);
