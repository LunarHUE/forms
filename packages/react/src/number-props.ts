import type { ValueOf } from "@lunarhue/forms-core";
import type { ChangeEvent } from "react";
import { refreshField } from "./field-api.js";
import type { EmptyOption, FieldObjectLike, NumberInputProps, OptionArgs, RangeInputProps } from "./input.js";
import { commandsOf, controlProps, kindProps, readOnly } from "./input-props.js";
import { cached } from "./select.js";

/**
 * What a number input showed after its last edit: the text and the value it
 * wrote. While the field still holds that value the input keeps the text,
 * so `1.` or `-` stays as typed instead of turning into `1` or nothing.
 */
interface Typed {
  readonly value: unknown;
  readonly text: string;
}

const typedTexts = new WeakMap<object, Typed>();

/** Records a field's typed text, or forgets it, and gives the field's readers a new field object. */
function record(handle: object, next: Typed | undefined): void {
  if (next === undefined && !typedTexts.has(handle)) return;
  if (next === undefined) typedTexts.delete(handle);
  else typedTexts.set(handle, next);
  refreshField(handle);
}

/** The text a number input shows: what the user typed while the field still holds what it wrote, else `field.text`. */
function textOf(field: FieldObjectLike): string {
  const typed = typedTexts.get(field.handle);
  return typed !== undefined && Object.is(typed.value, field.value) ? typed.text : field.text;
}

/** The pieces that bind a number input by hand. Each callback keeps its identity for the life of the handle. */
export interface NumberPieces {
  /** The text typed while the field still holds what it wrote, else `field.text`. */
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

/** The writes of a number input. `bad` is the browser's `validity.badInput`, set for text such as `-`. */
interface Writes {
  readonly write: (text: string, bad: boolean) => void;
  readonly setText: (text: string) => void;
  readonly handleBlur: () => void;
}

const writesCache = new WeakMap<object, Map<unknown, Writes>>();

const writesFor = (field: FieldObjectLike, empty: unknown): Writes =>
  cached(cached(writesCache, field.handle, () => new Map()), empty, () => {
    const { handle, handleBlur } = field;
    const commands = commandsOf(field);
    const write = (text: string, bad: boolean) => {
      if (readOnly(commands)) return;
      // The browser reports text such as `-` as an empty value with `badInput`.
      const number = bad || text.trim() === "" ? Number.NaN : Number(text);
      if (bad || (Number.isNaN(number) && text !== "")) {
        record(handle, { value: commands.peek().value, text });
        return;
      }
      const value = Number.isNaN(number) ? empty : number;
      record(handle, { value, text });
      commands.setValue(value);
    };
    return {
      write,
      setText: (text) => write(text, false),
      handleBlur() {
        record(handle, undefined);
        handleBlur();
      },
    };
  });

const piecesCache = new WeakMap<object, Map<unknown, NumberPieces>>();

/**
 * Returns the pieces for a number input bound by hand, such as a component
 * library's number field: `text`, `setText` and `handleBlur`. An empty input
 * writes `empty`, which is required when the field's type has no
 * `undefined`. The object changes only when the field object does.
 */
export const numberPieces: <F extends FieldObjectLike<number | null | undefined>>(
  field: F,
  ...options: OptionArgs<EmptyOption<ValueOf<F>>>
) => NumberPieces = (field: FieldObjectLike, options?: { readonly empty?: unknown }) => {
  const empty = options?.empty;
  return cached(cached(piecesCache, field, () => new Map()), empty, () => {
    const { setText, handleBlur } = writesFor(field, empty);
    return { text: textOf(field), setText, handleBlur };
  });
};

/**
 * Returns the props for `<input type="number">` on a number field. The input
 * keeps text such as `1.` or `-` as typed, including text the browser reports
 * only through `validity.badInput`, and drops it on blur. An empty input
 * writes `empty`, which is required when the field's type has no
 * `undefined`. See `inputProps`.
 */
export const numberProps: <F extends FieldObjectLike<number | null | undefined>>(
  field: F,
  ...options: OptionArgs<EmptyOption<ValueOf<F>>>
) => NumberInputProps = (field: FieldObjectLike, options?: { readonly empty?: unknown }) => {
  const empty = options?.empty;
  const writes = writesFor(field, empty);
  return kindProps(
    field,
    "number",
    empty,
    () => (event: ChangeEvent<HTMLInputElement>) => writes.write(event.target.value, event.target.validity.badInput),
    (onChange) => ({
      ...controlProps(field),
      onBlur: writes.handleBlur,
      type: "number",
      value: textOf(field),
      readOnly: field.readOnly,
      onChange,
    }),
  );
};

/** Returns the props for `<input type="range">` on a number field. See `inputProps`. */
export const rangeProps = (field: FieldObjectLike<number | null | undefined>): RangeInputProps =>
  kindProps(
    field,
    "range",
    undefined,
    (commands) => (event: ChangeEvent<HTMLInputElement>) => {
      if (!readOnly(commands)) commands.setValue(event.target.valueAsNumber);
    },
    (onChange) => ({ ...controlProps(field), type: "range", value: field.text, readOnly: field.readOnly, onChange }),
  );
