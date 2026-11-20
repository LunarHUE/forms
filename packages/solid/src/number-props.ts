import { createSignal } from "#solid";
import type { DescribedByOption, EmptyOption, FieldObjectLike, FieldValue, NumberInputProps, OptionArgs, RangeInputProps } from "./input.js";
import { cachedProps, current, handleOf, inputOf, typedKey, withControl } from "./input-props.js";
import { asText } from "./pieces.js";

/**
 * What a number input showed after its last edit: the text and the value it
 * wrote. While the field still holds that value the input keeps the text,
 * so `1.` or `-` stays as typed instead of turning into `1` or nothing.
 */
interface Typed {
  readonly value: unknown;
  readonly text: string;
}

/** The pieces that bind a number input by hand. */
export interface NumberPieces {
  /** The text typed while the field still holds what it wrote, else `field.text`. Reactive. */
  readonly text: string;
  /**
   * Writes text typed in the input. Text that isn't a number yet, such as
   * `-`, writes nothing. Text such as `12.` writes `12`. Empty text writes
   * `empty`. `text` keeps showing what was typed until the value changes or
   * the field blurs. Writes nothing while the field is read-only.
   */
  readonly setText: (text: string) => void;
  /** Marks the field touched, runs blur validation, and drops the typed text. */
  readonly handleBlur: () => void;
}

/** The typed text of one field object, shared by its number props and pieces. */
interface NumberState {
  readonly text: () => string;
  readonly write: (text: string, empty: unknown) => void;
  readonly handleBlur: () => void;
}

const states = new WeakMap<object, NumberState>();

function numberState(field: FieldObjectLike): NumberState {
  let state = states.get(field);
  if (state !== undefined) return state;
  // Equal typed text doesn't notify. Chrome reports `2.` as `2`, and writing
  // `2` back into a number input drops the dot and moves the caret to the start.
  const [typed, setTyped] = createSignal<Typed | undefined>(undefined, {
    ownedWrite: true,
    equals: (before, after) => before?.text === after?.text && Object.is(before?.value, after?.value),
  });
  const handle = handleOf(field);
  state = {
    text() {
      const last = typed();
      return last !== undefined && Object.is(last.value, field.value) ? last.text : field.text;
    },
    write(text, empty) {
      const { value: before, readOnly } = current(handle);
      if (readOnly) return;
      const number = text.trim() === "" ? Number.NaN : Number(text);
      if (Number.isNaN(number) && text !== "") {
        setTyped(() => ({ value: before, text }));
        return;
      }
      const value = Number.isNaN(number) ? empty : number;
      setTyped(() => ({ value, text }));
      handle.setValue(value);
    },
    handleBlur() {
      setTyped(undefined);
      field.handleBlur();
    },
  };
  states.set(field, state);
  return state;
}

/**
 * Returns the pieces for a number input bound by hand, such as a component
 * library's number field: `text`, `setText` and `handleBlur`. An empty input
 * writes `empty`, which is required when the field's type has no
 * `undefined`. It returns the same object for the same field object and
 * `empty`.
 */
export const numberPieces: <F extends FieldObjectLike<number | null | undefined>>(
  field: F,
  ...options: OptionArgs<EmptyOption<FieldValue<F>>>
) => NumberPieces = (field: FieldObjectLike, options?: { readonly empty?: unknown }) => {
  const empty = options?.empty;
  return cachedProps(field, "pieces", undefined, typedKey(empty), () => {
    const state = numberState(field);
    return {
      get text() {
        return state.text();
      },
      setText: (text: string) => state.write(text, empty),
      handleBlur: state.handleBlur,
    };
  });
};

/**
 * Returns the props for `<input type="number">` on a number field. The input
 * keeps text such as `1.` or `-` as typed, including text the browser reports
 * only through `validity.badInput`, and shows the field's number again on
 * blur. An empty input writes `empty`, which is required when the field's
 * type has no `undefined`. See `inputProps`.
 */
export const numberProps: <F extends FieldObjectLike<number | null | undefined>>(
  field: F,
  ...options: OptionArgs<EmptyOption<FieldValue<F>> & DescribedByOption>
) => NumberInputProps = (field: FieldObjectLike, options?: { readonly empty?: unknown } & DescribedByOption) => {
  const empty = options?.empty;
  return cachedProps(field, "number", options, typedKey(empty), () => {
    const state = numberState(field);
    const handle = handleOf(field);
    let element: HTMLInputElement | undefined;
    return withControl(field, options, {
      type: "number",
      get value() {
        return state.text();
      },
      get readonly() {
        return field.readOnly;
      },
      ref: (input: HTMLElement) => {
        if (input instanceof HTMLInputElement) element = input;
        field.ref(input);
      },
      onInput: (event: Event) => {
        const input = inputOf(event);
        // An empty value with `badInput` is text such as `-` or `1.` that isn't a number yet.
        // The element keeps it as typed, so this writes nothing and changes no text.
        if (input instanceof HTMLInputElement && !input.validity.badInput) state.write(input.value, empty);
      },
      onBlur: () => {
        state.handleBlur();
        // Once the input loses focus it shows the field's number again, including over text such as `1.`.
        if (element !== undefined) element.value = asText(current(handle).value);
      },
    });
  });
};

/** Returns the props for `<input type="range">` on a number field. See `inputProps`. */
export const rangeProps = (field: FieldObjectLike<number | null | undefined>, options?: DescribedByOption): RangeInputProps =>
  cachedProps(field, "range", options, "", () => {
    const handle = handleOf(field);
    return withControl(field, options, {
      type: "range",
      get value() {
        return field.text;
      },
      get readonly() {
        return field.readOnly;
      },
      onInput: (event: Event) => {
        const input = inputOf(event);
        if (!(input instanceof HTMLInputElement)) return;
        const snapshot = current(handle);
        // A browser moves a slider even while it is `readonly`, so this puts it back.
        if (snapshot.readOnly) input.value = asText(snapshot.value);
        else handle.setValue(input.valueAsNumber);
      },
    });
  });
