import { type ItemOf, optionId } from "@lunarhue/forms-core";
import type { CheckboxGroupInputProps, DescribedByOption, FieldObjectLike, FieldValue, RadioInputProps } from "./input.js";
import { ariaReadOnly, cachedProps, current, handleOf, inputOf, typedKey, withControl } from "./input-props.js";
import { asText, type PiecesHandle } from "./pieces.js";
import { elementsOf } from "./refs.js";

/** Puts every radio button of the field back to the field's value. */
function restoreRadios(handle: PiecesHandle): void {
  const value = asText(current(handle).value);
  for (const element of elementsOf(handle)) {
    if (element instanceof HTMLInputElement && element.type === "radio") element.checked = element.value === value;
  }
}

/**
 * Returns the props for one `<input type="radio">`, the one that writes
 * `value`. Every radio of a field shares `name`, and each gets core's
 * `optionId(handle.id, value)` as its id. The field holds a string, number
 * or boolean. See `inputProps`.
 */
export const radioProps: <F extends FieldObjectLike<string | number | boolean | null | undefined>>(
  field: F,
  value: NonNullable<FieldValue<F>>,
  options?: DescribedByOption,
) => RadioInputProps = (field: FieldObjectLike, value: unknown, options?: DescribedByOption) =>
  cachedProps(field, "radio", options, typedKey(value), () => {
    const handle = handleOf(field);
    return withControl(
      field,
      options,
      {
        type: "radio",
        value: asText(value),
        get checked() {
          return field.value === value;
        },
        get "aria-readonly"() {
          return ariaReadOnly(field);
        },
        onChange: (event: Event) => {
          const input = inputOf(event);
          if (!(input instanceof HTMLInputElement)) return;
          if (current(handle).readOnly) restoreRadios(handle);
          else if (input.checked) handle.setValue(value);
        },
      },
      optionId(field.handle.id, asText(value)),
    );
  });

/**
 * Returns the props for one checkbox of a group over an array of strings or
 * numbers. The box is checked while the array holds `value`, and a click adds
 * or removes it. Each box gets core's `optionId(handle.id, value)` as its id.
 * See `inputProps`.
 */
export const checkboxGroupProps: <F extends FieldObjectLike<readonly (string | number)[] | null | undefined>>(
  field: F,
  value: ItemOf<FieldValue<F>>,
  options?: DescribedByOption,
) => CheckboxGroupInputProps = (field: FieldObjectLike, value: unknown, options?: DescribedByOption) =>
  cachedProps(field, "group", options, typedKey(value), () => {
    const handle = handleOf(field);
    const holds = (list: unknown) => Array.isArray(list) && list.includes(value);
    return withControl(
      field,
      options,
      {
        type: "checkbox",
        value: asText(value),
        get checked() {
          return holds(field.value);
        },
        get "aria-readonly"() {
          return ariaReadOnly(field);
        },
        onChange: (event: Event) => {
          const input = inputOf(event);
          if (!(input instanceof HTMLInputElement)) return;
          const snapshot = current(handle);
          if (snapshot.readOnly) {
            input.checked = holds(snapshot.value);
            return;
          }
          const list: readonly unknown[] = Array.isArray(snapshot.value) ? snapshot.value : [];
          if (input.checked) handle.setValue(list.includes(value) ? list : [...list, value]);
          else handle.setValue(list.filter((each) => each !== value));
        },
      },
      optionId(field.handle.id, asText(value)),
    );
  });
