import type { FieldSnapshot, ValueOf } from "@lunarhue/forms-core";
import type { ChangeEvent } from "react";
import {
  type BaseInputProps,
  type CheckboxInputProps,
  type EmptyOption,
  errorId,
  type FieldObjectLike,
  type OptionArgs,
  type SelectProps,
  type TextareaProps,
  type TextInputOptions,
  type TextInputProps,
} from "./input.js";
import { asText } from "./pieces.js";
import { cached } from "./select.js";

/** What the props call on a field's handle. Every core handle has these. */
export interface Commands {
  setValue(value: unknown): void;
  peek(): FieldSnapshot<unknown, unknown>;
}

/** The handle's commands. The field object's types only name the handle's id. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const commandsOf = (field: FieldObjectLike): Commands => field.handle as unknown as Commands;

/** True while the field takes no edits. */
export const readOnly = (commands: Commands): boolean => commands.peek().readOnly;

// Callbacks are cached per handle and props per field object, then by kind
// and by the option the element was given.
const changeCache = new WeakMap<object, Map<string, Map<unknown, unknown>>>();
const propsCache = new WeakMap<object, Map<string, Map<unknown, unknown>>>();

/** The props every kind has. `id` is the handle's, unless the element is one option of the field. */
export function controlProps(field: FieldObjectLike, id: string = field.handle.id): BaseInputProps {
  // An ARIA state that is off is left out. React would write `false` as "false".
  const shown = field.shownErrors.length > 0 || undefined;
  return {
    name: field.name,
    id,
    onBlur: field.handleBlur,
    ref: field.ref,
    disabled: field.disabled,
    "aria-invalid": shown,
    "aria-describedby": shown ? errorId(field.handle) : undefined,
  };
}

/**
 * The props of one kind of element, made once per field object and option.
 * `change` makes the `onChange`, once per handle and option, and `build` the
 * props around it. So the callbacks keep their identity for the life of the
 * handle, and the props until the field object changes.
 */
export function kindProps<E, P>(
  field: FieldObjectLike,
  kind: string,
  option: unknown,
  change: (commands: Commands) => (event: E) => void,
  build: (onChange: (event: E) => void) => P,
): P {
  // Below its kind, each cache holds that kind's props or callbacks only.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const byOption = cached(cached(propsCache, field, () => new Map()), kind, () => new Map()) as Map<unknown, P>;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const changes = cached(cached(changeCache, field.handle, () => new Map()), kind, () => new Map()) as Map<unknown, (event: E) => void>;
  return cached(byOption, option, () => build(cached(changes, option, () => change(commandsOf(field)))));
}

/** The text a text input or textarea writes, through `setText` so a display such as a mask places the caret. */
const textChange =
  ({ setText }: FieldObjectLike) =>
  () =>
  (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setText(event.target.value, event);

/**
 * Returns the props for an `<input>` on a string field:
 * `<input {...inputProps(field)} />`. `type` is one of the text-like types and
 * defaults to `"text"`. `value` is `field.text`, and `onChange` writes through
 * `field.setText`.
 *
 * Every props function is a plain function, not a hook, so it can be called
 * anywhere the field object is, and a form that never calls one doesn't ship
 * it. Errors show in `aria-invalid` and `aria-describedby` only while they
 * are in `shownErrors`. The callbacks keep their identity for the life of the
 * handle, and the props object changes only when the field object does. A
 * component library's primitives usually own their ids and aria, so bind
 * those with the field's pieces instead.
 */
export const inputProps = (field: FieldObjectLike<string | null | undefined>, options?: TextInputOptions): TextInputProps => {
  const type = options?.type ?? "text";
  return kindProps(field, "text", type, textChange(field), (onChange) => ({
    ...controlProps(field),
    type,
    value: field.text,
    readOnly: field.readOnly,
    onChange,
  }));
};

/** Returns the props for a `<textarea>` on a string field. See `inputProps`. */
export const textareaProps = (field: FieldObjectLike<string | null | undefined>): TextareaProps =>
  kindProps(field, "textarea", undefined, textChange(field), (onChange) => ({
    ...controlProps(field),
    value: field.text,
    readOnly: field.readOnly,
    onChange,
  }));

/**
 * Returns the props for a single `<select>` on a string field. An option
 * whose value is `""` writes `empty`, which is required when the field's
 * type has no `undefined`. See `inputProps`.
 */
export const selectProps: <F extends FieldObjectLike<string | null | undefined>>(
  field: F,
  ...options: OptionArgs<EmptyOption<ValueOf<F>>>
) => SelectProps = (field: FieldObjectLike, options?: { readonly empty?: unknown }) => {
  const empty = options?.empty;
  return kindProps(
    field,
    "select",
    empty,
    (commands) => (event: ChangeEvent<HTMLSelectElement>) => {
      const { value } = event.target;
      if (!readOnly(commands)) commands.setValue(value === "" ? empty : value);
    },
    (onChange) => ({ ...controlProps(field), value: asText(field.value), "aria-readonly": field.readOnly || undefined, onChange }),
  );
};

/** Returns the props for `<input type="checkbox">` on a boolean field. See `inputProps`. */
export const checkboxProps = (field: FieldObjectLike<boolean | null | undefined>): CheckboxInputProps =>
  kindProps(
    field,
    "checkbox",
    undefined,
    (commands) => (event: ChangeEvent<HTMLInputElement>) => {
      if (!readOnly(commands)) commands.setValue(event.target.checked);
    },
    (onChange) => ({
      ...controlProps(field),
      type: "checkbox",
      checked: field.value === true,
      "aria-readonly": field.readOnly || undefined,
      onChange,
    }),
  );
