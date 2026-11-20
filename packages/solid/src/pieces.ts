import type { FieldSnapshot, Path, TextControl } from "@lunarhue/forms-core";
import { afterProps, batch } from "#solid";
import { untrack } from "solid-js";
import { displayOf } from "./display.js";
import { elementRegistrar, elementsOf } from "./refs.js";

/**
 * Where `setText` finds the element whose caret it places: the element
 * itself, or an event whose `target` is the element.
 */
export type TextSource = TextControl | { readonly target: EventTarget | null };

/** The pieces a field object carries for binding an element by hand. Only `text` is reactive. */
export interface FieldPieces {
  /** The text an element shows: the display text a plugin such as a mask gives, else the value. Reactive. */
  readonly text: string;
  /**
   * Writes text the user typed. When a plugin gives the field a display, such
   * as a mask, the display puts its text in the element and places the caret.
   * The element comes from `from`, or else is the focused element that `ref`
   * registered. Writes nothing while the field is read-only.
   */
  readonly setText: (text: string, from?: TextSource) => void;
  /** Marks the field touched and runs blur validation. */
  readonly handleBlur: () => void;
  /**
   * Registers the element so a failed submit can focus it, until the field's
   * owner is disposed. On a native input, textarea or select it also puts
   * the field's state back when the element differs, as when a browser
   * restored what the user typed before a reload.
   */
  readonly ref: (element: HTMLElement) => void;
}

/** The handle members the pieces call. Every core handle has them. */
export interface PiecesHandle {
  readonly path: Path;
  readonly store: { getSnapshot(path: Path): FieldSnapshot<unknown, unknown> };
  setValue(value: unknown): void;
  handleBlur(): void;
}

/** A field value as text: empty while it is null, undefined, `NaN` or not a primitive. */
export function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isNaN(value) ? "" : String(value);
  if (typeof value === "boolean" || typeof value === "bigint") return String(value);
  return "";
}

const isControl = (from: unknown): from is TextControl =>
  typeof from === "object" && from !== null && "setSelectionRange" in from && "value" in from;

/**
 * Writes the field's state to a native control as it registers. A browser
 * may put back what the user typed before a reload, after it parses the
 * server markup. Hydration doesn't write a prop the markup already has, so
 * without this the element would show text the form doesn't hold. A checkbox
 * of a group and a radio compare their own `value` with the field's.
 */
function showState(element: HTMLElement, value: unknown, text: string): void {
  if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
    let checked: boolean;
    if (element.type === "radio") checked = asText(value) === element.value;
    else if (Array.isArray(value)) checked = value.some((each) => asText(each) === element.value);
    else checked = value === true;
    if (element.checked !== checked) element.checked = checked;
  } else if (element instanceof HTMLSelectElement) {
    if (element.value !== asText(value)) element.value = asText(value);
  } else if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.value !== text) {
    element.value = text;
  }
}

/** The text an element shows: the display text a plugin gives, else the value. */
function textOf({ value, meta }: FieldSnapshot<unknown, unknown>): string {
  const shown = displayOf(meta);
  return shown ? shown.display(value) : asText(value);
}

/**
 * Adds the pieces to a field object. `read` is the field's snapshot as a
 * reactive read. Call it under the field's owner: the element registrations
 * belong to it.
 */
export function addPieces(field: object, handle: PiecesHandle, read: () => FieldSnapshot<unknown, unknown>): void {
  const register = elementRegistrar(handle);
  const current = () => handle.store.getSnapshot(handle.path);
  // `handleBlur` is the handle's own, which the field object already has.
  const pieces: Omit<FieldPieces, "text" | "handleBlur"> = {
    setText(text, from) {
      if (current().readOnly) return;
      // The display reads the element's text and caret after the write, before Solid updates the element.
      batch(() => {
        handle.setValue(text);
        const { value, meta } = current();
        const edit = displayOf(meta)?.edit;
        if (edit === undefined) return;
        const target = from === undefined || isControl(from) ? from : from.target;
        const active = typeof document === "undefined" ? null : document.activeElement;
        const focused = elementsOf(handle).some((element) => active !== null && element.contains(active)) ? active : undefined;
        const control = isControl(target) ? target : focused;
        if (isControl(control)) edit(control, value, from === undefined || isControl(from) ? {} : from);
      });
    },
    ref(element) {
      register(element);
      // The current snapshot, not the reactive one: the reader may still hold the server's while hydrating.
      afterProps(() => untrack(() => showState(element, current().value, textOf(current()))));
    },
  };
  Object.defineProperties(field, {
    ...Object.getOwnPropertyDescriptors(pieces),
    text: { enumerable: true, get: () => textOf(read()) },
  });
}
