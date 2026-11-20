import { errorId as coreErrorId, type FieldSnapshot } from "@lunarhue/forms-core";
import type { FieldTypes, HandleLike } from "./field.js";
import type { FieldPieces } from "./pieces.js";
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

/** The option every props function takes. */
export interface DescribedByOption {
  /** More ids for `aria-describedby`, such as a hint's, placed before the error id. */
  readonly describedBy?: string;
}

/** The options of `inputProps`. */
export interface TextInputOptions extends DescribedByOption {
  /** The input's `type`. Defaults to `"text"`. */
  readonly type?: TextInputType;
}

/**
 * The `empty` option of `numberProps`, `numberPieces` and `selectProps`: the
 * value an empty input writes. It defaults to `undefined`, so it is required
 * when the field's type has no `undefined`.
 */
export type EmptyOption<V> = undefined extends V ? { readonly empty?: V } : { readonly empty: V };

/** The rest argument of an options object: optional when every option is. */
export type OptionArgs<O> = object extends O ? [options?: O] : [options: O];

/**
 * What the props functions take: a field object, as `form.Field` gives it to
 * its children and `createField(handle)` returns it. Each function names the
 * value types it binds in `V`, so a field of another type fails the call.
 */
export interface FieldObjectLike<V = unknown> extends FieldSnapshot<unknown, unknown>, FieldPieces {
  readonly handle: { readonly id: string };
  /** Type information only. */
  readonly "~field"?: FieldTypes<V, unknown>;
}

/** The value type of a field object. */
export type FieldValue<F> = F extends { readonly "~field"?: FieldTypes<infer V, unknown> } ? V : never;

/** The props every input kind gets. */
export interface BaseInputProps<T extends HTMLElement> {
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
 * The props of a text input. `value` is `field.text`. `onInput` writes
 * `currentTarget.value` through `field.setText`. The DOM then already holds
 * what the field holds, so when Solid writes `value` back the caret stays
 * where it was.
 */
export interface TextInputProps extends BaseInputProps<HTMLInputElement> {
  /** The input's type. */
  readonly type: TextInputType;
  /** `field.text`. Reactive. */
  readonly value: string;
  /** The snapshot's `readOnly`. Reactive. */
  readonly readonly: boolean;
  /** Writes the input's text to the field. */
  readonly onInput: (event: Event) => void;
}

/** The props of a textarea. They are the text input's without `type`. */
export interface TextareaProps extends BaseInputProps<HTMLTextAreaElement> {
  /** `field.text`. Reactive. */
  readonly value: string;
  /** The snapshot's `readOnly`. Reactive. */
  readonly readonly: boolean;
  /** Writes the textarea's text to the field. */
  readonly onInput: (event: Event) => void;
}

/**
 * The props of `<input type="number">`. `onInput` writes the typed number,
 * writes `empty` when the input is empty, and writes nothing while the
 * browser reports `validity.badInput`, so `1.` or `-` stay as typed.
 */
export interface NumberInputProps extends BaseInputProps<HTMLInputElement> {
  readonly type: "number";
  /** The text typed while the field still holds what it wrote, else `field.text`. Reactive. */
  readonly value: string;
  /** The snapshot's `readOnly`. Reactive. */
  readonly readonly: boolean;
  /** Writes the input's number to the field. */
  readonly onInput: (event: Event) => void;
}

/** The props of `<input type="range">`. */
export interface RangeInputProps extends BaseInputProps<HTMLInputElement> {
  readonly type: "range";
  /** `field.text`. Reactive. */
  readonly value: string;
  /** The snapshot's `readOnly`. Reactive. */
  readonly readonly: boolean;
  /** Writes `valueAsNumber`. While the field is read-only it puts the slider back instead. */
  readonly onInput: (event: Event) => void;
}

/**
 * The props of `<input type="checkbox">` on a boolean field. HTML has no
 * read-only checkbox, so while the field is read-only `onChange` puts
 * `checked` back and writes nothing, and `aria-readonly` says so. Radios and
 * selects work the same way.
 */
export interface CheckboxInputProps extends BaseInputProps<HTMLInputElement> {
  readonly type: "checkbox";
  /** On a boolean field, the value. On a group, whether the array holds this box's option. Reactive. */
  readonly checked: boolean;
  /** `"true"` while the field is read-only, else absent. Reactive. */
  readonly "aria-readonly": "true" | undefined;
  /** On a boolean field, writes `checked`. On a group, adds or removes the option. */
  readonly onChange: (event: Event) => void;
}

/** The props of one checkbox of a group over an array field. */
export interface CheckboxGroupInputProps extends CheckboxInputProps {
  /** The option as text. */
  readonly value: string;
}

/** The props of one `<input type="radio">`. Every radio of a field shares `name`. */
export interface RadioInputProps extends BaseInputProps<HTMLInputElement> {
  readonly type: "radio";
  /** The option as text. */
  readonly value: string;
  /** True when the field's value is this option. Reactive. */
  readonly checked: boolean;
  /** `"true"` while the field is read-only, else absent. Reactive. */
  readonly "aria-readonly": "true" | undefined;
  /** Writes this option, unless the field is read-only. */
  readonly onChange: (event: Event) => void;
}

/** The props of a single `<select>`. `<select multiple>` is not covered. */
export interface SelectProps extends BaseInputProps<HTMLSelectElement> {
  /** The value, or `""` while it is null or undefined. Reactive. */
  readonly value: string;
  /** `"true"` while the field is read-only, else absent. Reactive. */
  readonly "aria-readonly": "true" | undefined;
  /** Writes the chosen option's value, or `empty` for an option whose value is `""`. */
  readonly onChange: (event: Event) => void;
}

/**
 * Returns a ref callback that registers an element as the focus target of a
 * field, for custom inputs bound without the props functions. Use it as
 * `ref={fieldRef(handle)}`, and call it in a component body: the element is
 * forgotten when that owner is disposed.
 */
export const fieldRef = (handle: HandleLike): ((element: HTMLElement) => void) => elementRegistrar(handle);

/**
 * Returns the id the input props point `aria-describedby` at while the field
 * shows errors, core's `errorId(handle.id)`: the handle id with `---error`
 * after it. Put it on the element that renders the errors.
 */
export const errorId = (handle: Pick<HandleLike, "id">): string => coreErrorId(handle.id);
