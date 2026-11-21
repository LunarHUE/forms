import { describe, expect, it } from "vitest";
import type { TextControl } from "../plugin.js";
import { replaceText } from "./caret.js";

/** Shows "5551234" as "(555) 123-4". */
const phone = (value: string) => {
  if (value.length > 6) return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
  if (value.length > 3) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
  return value;
};

const clean = (text: string) => text.replace(/\D/g, "");

/** A text control the way an input holds it after an edit: the typed text with the caret in it. */
function control(value: string, caret: number | null): TextControl & { readonly selection: () => number | null } {
  let at = caret;
  return {
    value,
    get selectionStart() {
      return at;
    },
    setSelectionRange: (start: number) => void (at = start),
    selection: () => at,
  };
}

/** Runs one edit: `typed` with the caret at `caret`, of input type `inputType`. Returns the text and caret after. */
function edit(typed: string, caret: number, inputType: string) {
  const input = control(typed, caret);
  replaceText(input, phone(clean(typed)), clean, { inputType });
  return [input.value, input.selection()];
}

describe("replaceText", () => {
  // Each starts from "(555) 123-4".
  it("keeps the caret after a character typed in the middle", () => {
    expect(edit("(555) 1923-4", 8, "insertText")).toEqual(["(555) 192-34", 8]);
  });

  it("steps back across a character the display added on backspace", () => {
    expect(edit("(555) 1234", 9, "deleteContentBackward")).toEqual(["(555) 123-4", 9]);
    expect(edit("(555)123-4", 5, "deleteContentBackward")).toEqual(["(555) 123-4", 4]);
  });

  it("steps over a character the display added on a forward delete", () => {
    expect(edit("(555) 1234", 9, "deleteContentForward")).toEqual(["(555) 123-4", 10]);
  });

  it("puts the caret after a typed-over selection and after a paste", () => {
    expect(edit("(555) 7-4", 7, "insertText")).toEqual(["(555) 74", 7]);
    expect(edit("(555) 88123-4", 8, "insertFromPaste")).toEqual(["(555) 881-234", 8]);
  });

  it("leaves the caret where it was when the typed character is dropped", () => {
    expect(edit("(555) a123-4", 7, "insertText")).toEqual(["(555) 123-4", 6]);
  });

  it("puts the caret at the end after typing at the end", () => {
    expect(edit("(555) 123-45", 12, "insertText")).toEqual(["(555) 123-45", 12]);
  });

  it("sets the text alone on an input with no caret", () => {
    const input = control("1-2", null);
    replaceText(input, "12", clean, {});
    expect([input.value, input.selection()]).toEqual(["12", null]);
  });
});
