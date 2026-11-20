import type { FieldSnapshot, TextControl } from "@lunarhue/forms-core";
import { displayOf } from "./display.js";
import type { FieldRef } from "./input.js";
import { focusedElement, refFor } from "./refs.js";
import { cached } from "./select.js";

/**
 * Where `setText` finds the element whose caret it places: the element
 * itself, or an event whose `target` is the element. A React change event,
 * a DOM input event and Base UI's `eventDetails.event` all fit.
 */
export type TextSource = TextControl | { readonly target: EventTarget | null };

/** The pieces a field object carries for binding an element by hand. Each keeps its identity for the life of the handle. */
export interface FieldPieces {
  /**
   * Writes text the user typed. When a plugin gives the field a display, such
   * as a mask, the display puts its text in the element and places the caret.
   * The element comes from `from`, or else is the focused element that `ref`
   * recorded. Writes nothing while the field is read-only.
   */
  readonly setText: (text: string, from?: TextSource) => void;
  /** Marks the field touched and runs blur validation. */
  readonly handleBlur: () => void;
  /**
   * Records the element for focus after an invalid submit. On a native
   * input, textarea or select it also puts back what React rendered when the
   * browser restored what the user typed before a reload. See `FieldRef`.
   */
  readonly ref: FieldRef;
}

/** What the pieces call on a core handle. */
interface Commands {
  setValue(value: unknown): void;
  peek(): FieldSnapshot<unknown, unknown>;
  handleBlur(): void;
}

/** Shows `null` and `undefined` as `""`. */
export const asText = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" ? String(value) : "";

/**
 * The text an element shows for a field: the display text when a plugin
 * gives one, else the value. `NaN` shows as `""`.
 */
export function textOf({ value, meta }: FieldSnapshot<unknown, unknown>): string {
  const shown = displayOf(meta);
  if (shown) return shown.display(value);
  return typeof value === "number" && Number.isNaN(value) ? "" : asText(value);
}

const isControl = (from: unknown): from is TextControl =>
  typeof from === "object" && from !== null && "setSelectionRange" in from && "value" in from;

/** The native event of a React event, or the event itself. */
const nativeOf = (from: object): object => ("nativeEvent" in from && typeof from.nativeEvent === "object" && from.nativeEvent) || from;

const piecesCache = new WeakMap<object, FieldPieces>();

/** The pieces for `handle`, made once. */
export const piecesFor = (handle: object): FieldPieces =>
  cached(piecesCache, handle, () => {
    // Every core handle has these commands.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const commands = handle as Commands;
    return {
      setText(text, from) {
        if (commands.peek().readOnly) return;
        commands.setValue(text);
        const { value, meta } = commands.peek();
        const edit = displayOf(meta)?.edit;
        if (edit === undefined) return;
        const target = from === undefined || isControl(from) ? from : from.target;
        const control = isControl(target) ? target : focusedElement(handle);
        if (isControl(control)) edit(control, value, from === undefined || isControl(from) ? {} : nativeOf(from));
      },
      handleBlur: () => commands.handleBlur(),
      ref: refFor(handle),
    };
  });
