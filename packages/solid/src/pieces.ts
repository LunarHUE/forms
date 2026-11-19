import type { FieldSnapshot, Path, TextControl } from "@lunarhue/forms-core";
import { afterProps, batch, createSignal } from "#solid";
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
  /**
   * The text an element shows: the number text the user is typing, else the
   * display text a plugin such as a mask gives, else the value. Reactive.
   */
  readonly text: string;
  /**
   * Writes text the user typed. When a plugin gives the field a display, such
   * as a mask, the display puts its text in the element and places the caret.
   * The element comes from `from`, or else is the focused element that `ref`
   * registered. Writes nothing while the field is read-only.
   */
  readonly setText: (text: string, from?: TextSource) => void;
  /**
   * Writes text typed in a number field. Text that isn't a number yet, such
   * as `-`, writes nothing. Text such as `12.` writes `12`. `text` keeps
   * showing the typed text until the value changes or the field blurs. Empty
   * text writes `empty`.
   */
  readonly setNumberText: (text: string, empty?: unknown) => void;
  /** Marks the field touched, runs blur validation, and drops the typed number text. */
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

/** What a number input showed after its last edit, and the value it wrote. */
interface NumberText {
  readonly value: unknown;
  readonly text: string;
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

/**
 * Adds the pieces to a field object. `read` is the field's snapshot as a
 * reactive read. Call it under the field's owner: the typed-text signal and
 * the element registrations belong to it.
 */
export function addPieces(field: object, handle: PiecesHandle, read: () => FieldSnapshot<unknown, unknown>): void {
  // Equal typed text doesn't notify. Chrome reports `2.` as `2`, and writing
  // `2` back into a number input drops the dot and moves the caret to the start.
  const [typed, setTyped] = createSignal<NumberText | undefined>(undefined, {
    ownedWrite: true,
    equals: (before, after) => before?.text === after?.text && Object.is(before?.value, after?.value),
  });
  const register = elementRegistrar(handle);
  const current = () => handle.store.getSnapshot(handle.path);
  const textOf = (typedText: NumberText | undefined, { value, meta }: FieldSnapshot<unknown, unknown>): string => {
    if (typedText !== undefined && Object.is(typedText.value, value)) return typedText.text;
    const shown = displayOf(meta);
    return shown ? shown.display(value) : asText(value);
  };
  const pieces: Omit<FieldPieces, "text"> = {
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
    setNumberText(text, empty) {
      const { value: before, readOnly } = current();
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
      handle.handleBlur();
    },
    ref(element) {
      register(element);
      // The current snapshot, not the reactive one: the reader may still hold the server's while hydrating.
      afterProps(() => untrack(() => showState(element, current().value, textOf(typed(), current()))));
    },
  };
  Object.defineProperties(field, {
    ...Object.getOwnPropertyDescriptors(pieces),
    text: { enumerable: true, get: () => textOf(typed(), read()) },
  });
}
