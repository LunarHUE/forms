import { errorId, type FieldSnapshot } from "@lunarhue/forms-core";
import type {
  BaseInputProps,
  CheckboxInputProps,
  DescribedByOption,
  EmptyOption,
  FieldObjectLike,
  FieldValue,
  OptionArgs,
  SelectProps,
  TextareaProps,
  TextInputOptions,
  TextInputProps,
} from "./input.js";
import { asText, type PiecesHandle } from "./pieces.js";

/** The handle's commands. The field object's types only name the handle's id. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
export const handleOf = (field: FieldObjectLike): PiecesHandle => field.handle as unknown as PiecesHandle;

/** The current snapshot from the store, for event handlers. */
export const current = (handle: PiecesHandle): FieldSnapshot<unknown, unknown> => handle.store.getSnapshot(handle.path);

/** The input element an event was bound on. */
export function inputOf(event: Event): HTMLInputElement | HTMLTextAreaElement | undefined {
  const target = event.currentTarget;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target : undefined;
}

/** `"true"` while the field is read-only. For elements HTML has no `readonly` for. */
export const ariaReadOnly = (field: FieldObjectLike): "true" | undefined => (field.readOnly ? "true" : undefined);

/**
 * Adds the props every kind shares to `own` and returns it. The getters read
 * the field's getters, so each is a reactive read of that field only. `id`
 * is the element's id, the handle's unless the element is one option of the
 * field. The caller's signature types the result.
 */
export function withControl(field: FieldObjectLike, options: DescribedByOption | undefined, own: object, id = field.handle.id): never {
  const errorsId = errorId(field.handle.id);
  const control: BaseInputProps<HTMLElement> = {
    id,
    get name() {
      return field.name;
    },
    ref: field.ref,
    onBlur: field.handleBlur,
    get disabled() {
      return field.disabled;
    },
    get "aria-invalid"() {
      return field.shownErrors.length > 0 ? "true" : undefined;
    },
    get "aria-describedby"() {
      const ids: string[] = [];
      if (options?.describedBy) ids.push(options.describedBy);
      if (field.shownErrors.length > 0) ids.push(errorsId);
      return ids.length > 0 ? ids.join(" ") : undefined;
    },
  };
  // A prop of `own` wins over the shared one of the same name.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.defineProperties(own, { ...Object.getOwnPropertyDescriptors(control), ...Object.getOwnPropertyDescriptors(own) }) as never;
}

const propsCache = new WeakMap<object, Map<string, unknown>>();

/** An option value with its type, so `1` and `"1"` give different keys. */
export const typedKey = (value: unknown): string => `${typeof value}:${asText(value)}`;

/**
 * The props of one kind of element, built once per field object, kind and
 * key. The key names every option the props depend on, so a call in JSX gets
 * the same object back each time.
 */
export function cachedProps<P>(field: FieldObjectLike, kind: string, options: DescribedByOption | undefined, key: string, build: () => P): P {
  let byKey = propsCache.get(field);
  if (byKey === undefined) propsCache.set(field, (byKey = new Map()));
  const full = `${kind}|${options?.describedBy ?? ""}|${key}`;
  // Each key holds the props `build` made for it.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  let props = byKey.get(full) as P | undefined;
  if (props === undefined) byKey.set(full, (props = build()));
  return props;
}

/** The props of a text input or textarea, without `type`. */
const textProps = (field: FieldObjectLike) => ({
  get value() {
    return field.text;
  },
  get readonly() {
    return field.readOnly;
  },
  onInput: (event: Event) => {
    const input = inputOf(event);
    if (input) field.setText(input.value, event);
  },
});

/**
 * Returns the props for an `<input>` on a string field:
 * `<input {...inputProps(field)} />`. `type` is one of the text-like types
 * and defaults to `"text"`. `value` is `field.text`, and `onInput` writes
 * through `field.setText`. `describedBy` adds ids to `aria-describedby`,
 * before the error id.
 *
 * Every props function is a plain function: call it in JSX or a component
 * body. The value, `name`, flags and aria members are getters over the
 * field's getters, so each updates on its own. The handlers are fixed
 * functions, so Solid binds them once. A props function returns the same
 * object for the same field object and options, and a form that never calls
 * one doesn't ship it. A component library's primitives usually own their
 * ids and aria, so bind those with the field's pieces instead.
 *
 * To run your own handler as well, spread these props, set your own handler
 * after them, and call ours from it.
 */
export const inputProps = (field: FieldObjectLike<string | null | undefined>, options?: TextInputOptions): TextInputProps => {
  const type = options?.type ?? "text";
  // Defined, not spread in, so the getters of the text props stay getters.
  return cachedProps(field, "text", options, type, () =>
    withControl(field, options, Object.defineProperty(textProps(field), "type", { value: type, enumerable: true })),
  );
};

/** Returns the props for a `<textarea>` on a string field. See `inputProps`. */
export const textareaProps = (field: FieldObjectLike<string | null | undefined>, options?: DescribedByOption): TextareaProps =>
  cachedProps(field, "textarea", options, "", () => withControl(field, options, textProps(field)));

/**
 * Returns the props for a single `<select>` on a string field. An option
 * whose value is `""` writes `empty`, which is required when the field's
 * type has no `undefined`. See `inputProps`.
 */
export const selectProps: <F extends FieldObjectLike<string | null | undefined>>(
  field: F,
  ...options: OptionArgs<EmptyOption<FieldValue<F>> & DescribedByOption>
) => SelectProps = (field: FieldObjectLike, options?: { readonly empty?: unknown } & DescribedByOption) => {
  const empty = options?.empty;
  return cachedProps(field, "select", options, typedKey(empty), () => {
    const handle = handleOf(field);
    return withControl(field, options, {
      get value() {
        return asText(field.value);
      },
      get "aria-readonly"() {
        return ariaReadOnly(field);
      },
      onChange: (event: Event) => {
        const select = event.currentTarget;
        if (!(select instanceof HTMLSelectElement)) return;
        const snapshot = current(handle);
        if (snapshot.readOnly) select.value = asText(snapshot.value);
        else handle.setValue(select.value === "" ? empty : select.value);
      },
    });
  });
};

/** Returns the props for `<input type="checkbox">` on a boolean field. See `inputProps`. */
export const checkboxProps = (field: FieldObjectLike<boolean | null | undefined>, options?: DescribedByOption): CheckboxInputProps =>
  cachedProps(field, "checkbox", options, "", () => {
    const handle = handleOf(field);
    return withControl(field, options, {
      type: "checkbox",
      // Solid 2 runs the ref before it sets `type`, and the ref writes the field's text as `value`.
      // When `type` turns the input into a checkbox, that text becomes the `value` attribute. This removes it.
      value: undefined,
      get checked() {
        return field.value === true;
      },
      get "aria-readonly"() {
        return ariaReadOnly(field);
      },
      onChange: (event: Event) => {
        const input = inputOf(event);
        if (!(input instanceof HTMLInputElement)) return;
        const snapshot = current(handle);
        if (snapshot.readOnly) input.checked = snapshot.value === true;
        else handle.setValue(input.checked);
      },
    });
  });
