import type { TextControl } from "../plugin.js";

/**
 * Puts `text` in `input` and keeps the caret where the user was typing.
 * Call it from a part's `afterInput`, while `input` still holds the
 * typed text and its caret, with the display text as `text`.
 *
 * `clean` cleans text as the store does and returns a string. The caret
 * goes after as many kept characters of `text` as the typed text had
 * before the caret. After an insert it also steps over the characters the
 * display added, so typing carries on past a `-`. After a backward delete
 * it doesn't, so the next backspace deletes a kept character. `event` is
 * the input event, read for its `inputType`. An input with no caret, such
 * as `type="email"`, gets the text alone.
 */
export function replaceText(input: TextControl, text: string, clean: (text: string) => unknown, event: object): void {
  const kept = (part: string) => {
    const out = clean(part);
    return typeof out === "string" ? out.length : 0;
  };
  const typed = input.value;
  const caret = input.selectionStart;
  input.value = text;
  if (caret === null) return;
  const want = kept(typed.slice(0, caret));
  let at = 0;
  while (at < text.length && kept(text.slice(0, at)) < want) at++;
  if (!("inputType" in event && typeof event.inputType === "string" && event.inputType.endsWith("Backward"))) {
    while (at < text.length && kept(text.slice(0, at + 1)) === kept(text.slice(0, at))) at++;
  }
  input.setSelectionRange(at, at);
}
