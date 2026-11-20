import { type ItemOf, optionId, type ValueOf } from "@lunarhue/forms-core";
import type { ChangeEvent } from "react";
import type { CheckboxGroupInputProps, FieldObjectLike, RadioInputProps } from "./input.js";
import { controlProps, kindProps, readOnly } from "./input-props.js";
import { asText } from "./pieces.js";

/**
 * Returns the props for one `<input type="radio">`, the one that writes
 * `value`. Every radio of a field shares `name`, and each gets core's
 * `optionId(handle.id, value)` as its id. The field holds a string, number
 * or boolean. See `inputProps`.
 */
export const radioProps: <F extends FieldObjectLike<string | number | boolean | null | undefined>>(
  field: F,
  value: NonNullable<ValueOf<F>>,
) => RadioInputProps = (field: FieldObjectLike, value: unknown) =>
  kindProps(
    field,
    "radio",
    value,
    (commands) => (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked && !readOnly(commands)) commands.setValue(value);
    },
    (onChange) => ({
      ...controlProps(field, optionId(field.handle.id, asText(value))),
      type: "radio",
      value: asText(value),
      checked: Object.is(field.value, value),
      "aria-readonly": field.readOnly || undefined,
      onChange,
    }),
  );

/**
 * Returns the props for one checkbox of a group over an array of strings or
 * numbers. The box is checked while the array holds `value`, and a click adds
 * or removes it. Each box gets core's `optionId(handle.id, value)` as its id.
 * See `inputProps`.
 */
export const checkboxGroupProps: <F extends FieldObjectLike<readonly (string | number)[] | null | undefined>>(
  field: F,
  value: ItemOf<ValueOf<F>>,
) => CheckboxGroupInputProps = (field: FieldObjectLike, value: unknown) =>
  kindProps(
    field,
    "group",
    value,
    (commands) => (event: ChangeEvent<HTMLInputElement>) => {
      const snapshot = commands.peek();
      if (snapshot.readOnly) return;
      const list: readonly unknown[] = Array.isArray(snapshot.value) ? snapshot.value : [];
      const has = list.includes(value);
      if (event.target.checked && !has) commands.setValue([...list, value]);
      if (!event.target.checked && has) commands.setValue(list.filter((item) => !Object.is(item, value)));
    },
    (onChange) => ({
      ...controlProps(field, optionId(field.handle.id, asText(value))),
      type: "checkbox",
      value: asText(value),
      checked: Array.isArray(field.value) && field.value.includes(value),
      "aria-readonly": field.readOnly || undefined,
      onChange,
    }),
  );
