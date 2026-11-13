import type { LeafHandle } from "@lunarhue/forms-core";
import type { ChangeEvent } from "react";
import type { HandleLike } from "./field.js";
import { notImplemented } from "./not-implemented.js";

/**
 * The ref callback the adapter puts on a field's element. It records the
 * element for focus after an invalid submit and returns the cleanup that
 * forgets it. React 19 calls the cleanup. React 18 and older call the
 * callback again with `null`, which forgets it too.
 */
export type FieldRef = (element: HTMLElement | null) => (() => void) | undefined;

/** The props every input kind gets. */
export interface BaseInputProps {
  /** The field's dotted name from its snapshot, such as `rows.0.title`. */
  readonly name: string;
  /** The handle's id, for `<label htmlFor>`. Radios add the option to it. */
  readonly id: string;
  /** Marks the field touched and runs blur validation. */
  readonly onBlur: () => void;
  /** Records the element for focus. See `FieldRef`. */
  readonly ref: FieldRef;
  /** The snapshot's `disabled`. */
  readonly disabled: boolean;
  /** True when the field has errors in `shownErrors`. */
  readonly "aria-invalid": boolean;
  /** `errorId(handle)` while the field has errors in `shownErrors`, else undefined. */
  readonly "aria-describedby": string | undefined;
}

/** Props for `<input>` and `<textarea>` on a string field. */
export interface TextInputProps extends BaseInputProps {
  /** The value, with `null` and `undefined` shown as `""`. */
  readonly value: string;
  /** The snapshot's `readOnly`. */
  readonly readOnly: boolean;
  /** Writes the element's value as a user edit. */
  readonly onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

/** Props for `<input type="number">`. */
export interface NumberInputProps extends BaseInputProps {
  readonly type: "number";
  /** The number as text, with `null`, `undefined` and `NaN` shown as `""`. */
  readonly value: string;
  /** The snapshot's `readOnly`. */
  readonly readOnly: boolean;
  /** Writes `valueAsNumber`, or the `empty` option when the input is empty. */
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Props for `<input type="checkbox">` on a boolean field. Browsers ignore
 * `readOnly` on checkboxes, so it is `aria-readonly` here and `onChange`
 * writes nothing while the field is read-only.
 */
export interface CheckboxInputProps extends BaseInputProps {
  readonly type: "checkbox";
  /** True when the value is `true`. */
  readonly checked: boolean;
  /** The snapshot's `readOnly`. */
  readonly "aria-readonly": boolean;
  /** Writes `checked` as a user edit, unless the field is read-only. */
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Props for one `<input type="radio">` of a group. Every radio of a field
 * shares `name`. Read-only works as on checkboxes.
 */
export interface RadioInputProps extends BaseInputProps {
  readonly type: "radio";
  /** `String(option)`. */
  readonly value: string;
  /** True when the field's value is this option. */
  readonly checked: boolean;
  /** The snapshot's `readOnly`. */
  readonly "aria-readonly": boolean;
  /** Writes this option as a user edit, unless the field is read-only. */
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Props for a single `<select>`. Browsers ignore `readOnly` on selects, so
 * it works as on checkboxes.
 */
export interface SelectProps extends BaseInputProps {
  /** The value, with `null` and `undefined` shown as `""`. */
  readonly value: string;
  /** The snapshot's `readOnly`. */
  readonly "aria-readonly": boolean;
  /** Writes the chosen option's value, or `empty` for an option whose value is `""`. */
  readonly onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}

/**
 * The `empty` option of number and select inputs: the value an empty input
 * writes. It defaults to `undefined`, so it is required when the field's
 * type has no `undefined`.
 */
export type EmptyOption<V> = undefined extends V
  ? { readonly empty?: V }
  : { readonly empty: V };

/** Options for a text input. `kind` defaults to `"text"`. */
export interface TextInputOptions {
  readonly kind?: "text";
}

/** Options for a number input. */
export type NumberInputOptions<V> = { readonly kind: "number" } & EmptyOption<V>;

/** Options for a checkbox. */
export interface CheckboxInputOptions {
  readonly kind: "checkbox";
}

/** Options for one radio. `value` is the option this radio writes. */
export interface RadioInputOptions<V> {
  readonly kind: "radio";
  readonly value: NonNullable<V>;
}

/** Options for a select. */
export type SelectOptions<V> = { readonly kind: "select" } & EmptyOption<V>;

/** What `useInputProps` needs from a handle: a leaf handle of value type `V`. */
export type InputHandle<V, E> = LeafHandle<V, E>;

/**
 * Returns the props that bind one element to a leaf field. The kind is
 * checked against the field's value type: text and select need a string
 * field, number a number field, checkbox a boolean field, radio a field
 * whose type includes the option. Errors show in `aria-invalid` and
 * `aria-describedby` only while they are in `shownErrors`.
 *
 * The callbacks keep their identity for the life of the handle. The props
 * object changes only when the field's snapshot does.
 */
export interface UseInputProps {
  <V extends string | null | undefined, E>(handle: InputHandle<V, E>, options?: TextInputOptions): TextInputProps;
  <V extends number | null | undefined, E>(
    handle: InputHandle<V, E>,
    options: NumberInputOptions<NoInfer<V>>,
  ): NumberInputProps;
  <V extends boolean | null | undefined, E>(handle: InputHandle<V, E>, options: CheckboxInputOptions): CheckboxInputProps;
  <V extends string | number | boolean | null | undefined, E>(
    handle: InputHandle<V, E>,
    options: RadioInputOptions<NoInfer<V>>,
  ): RadioInputProps;
  <V extends string | null | undefined, E>(handle: InputHandle<V, E>, options: SelectOptions<NoInfer<V>>): SelectProps;
}

/** See `UseInputProps`. Not implemented yet: it throws. */
export const useInputProps: UseInputProps = notImplemented("useInputProps");

/**
 * Returns a ref callback that records an element for a field, for custom
 * inputs that don't use `useInputProps`. The callback keeps its identity for
 * the life of the handle.
 */
export type UseFieldRef = (handle: HandleLike) => FieldRef;

/** See `UseFieldRef`. Not implemented yet: it throws. */
export const useFieldRef: UseFieldRef = notImplemented("useFieldRef");

/**
 * The id of the element that shows a field's errors: the handle id with
 * `---error` after it. No field id contains `---`, so it never names a
 * field. Input props point `aria-describedby` at it.
 */
export type ErrorId = (handle: { readonly id: string }) => string;

/** See `ErrorId`. Not implemented yet: it throws. */
export const errorId: ErrorId = notImplemented("errorId");
