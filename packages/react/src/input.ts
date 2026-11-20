import { errorId as coreErrorId, type FieldSnapshot, type HandleTypes } from "@lunarhue/forms-core";
import type { ChangeEvent } from "react";
import type { HandleLike } from "./field.js";
import type { FieldPieces } from "./pieces.js";
import { refFor } from "./refs.js";

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

/** Props for `<input type="number">` on a number field. */
export interface NumberInputProps extends BaseInputProps {
  readonly type: "number";
  /** The text typed while the field still holds what it wrote, else `field.text`. */
  readonly value: string;
  /** The snapshot's `readOnly`. */
  readonly readOnly: boolean;
  /** Writes the typed number, or `empty` when the input is empty. Text that isn't a number yet writes nothing. */
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Marks the field touched, runs blur validation, and drops the typed text. */
  readonly onBlur: () => void;
}

/** Props for `<input type="range">` on a number field. */
export interface RangeInputProps extends BaseInputProps {
  readonly type: "range";
  /** The number as text, with `null`, `undefined` and `NaN` shown as `""`. */
  readonly value: string;
  /** The snapshot's `readOnly`. */
  readonly readOnly: boolean;
  /** Writes `valueAsNumber`, unless the field is read-only. */
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
 * The options of `numberProps`, `numberPieces` and `selectProps`. `empty` is
 * the value an empty input writes. It defaults to `undefined`, so it is
 * required when the field's type has no `undefined`.
 */
export type EmptyOption<V> = undefined extends V ? { readonly empty?: V } : { readonly empty: V };

/** The rest argument of an options object: optional when every option is. */
export type OptionArgs<O> = object extends O ? [options?: O] : [options: O];

/** The options of `inputProps`. */
export interface TextInputOptions {
  /** The input's `type`. Defaults to `"text"`. */
  readonly type?: TextInputType;
}

/**
 * What the props functions take: a field object, as `form.Field` gives it to
 * its children and `useField(handle)` returns it. Each function names the
 * value types it binds in `V`, so a field of another type fails the call.
 */
export interface FieldObjectLike<V = unknown> extends FieldSnapshot<unknown, unknown>, FieldPieces {
  readonly handle: { readonly id: string };
  readonly text: string;
  /** Type information only. */
  readonly "~types"?: HandleTypes<V, unknown>;
}

/**
 * Returns a ref callback that records an element for a field, for custom
 * inputs bound without the props functions. The callback keeps its identity for
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
