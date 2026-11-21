// The ./text entry: parts that clean a text field's value and set the text its inputs show.
import type { Part } from "../plugin.js";
import { part, type PartWrite, type ValuePartHooks } from "../plugins/part.js";
import { replaceText } from "./caret.js";

export { replaceText } from "./caret.js";

/** A cleaner for a string field. It gets the value so far and the caller's original input. */
export type Clean = (value: string, input: unknown) => string;

/** Keeps the digits of a string. */
export const digits: Clean = (value) => value.replace(/\D/g, "");

/** Upper-cases a string. */
export const upper: Clean = (value) => value.toUpperCase();

/** What `masked` takes: a field's cleaner and the text its inputs show. */
export interface MaskConfig {
  /** Cleans the value before the store takes it. */
  readonly clean: Clean;
  /**
   * The text a text input shows for the clean stored value, as
   * `(555) 123-4567` for `5551234567`. It must be a pure function of the
   * value. A value that isn't a string comes in as `""`.
   */
  readonly display?: (value: string) => string;
}

const keep: Clean = (value) => value;

const cleaning = (clean: Clean): ValuePartHooks<string> => ({
  // Rebases aren't cleaned: the incoming value is the server's copy. A value that isn't a string is left alone.
  beforeWrite: ({ value, input, cause }: PartWrite<string>) => (typeof value === "string" && cause !== "rebase" ? clean(value, input) : value),
});

const displaying = (display: (value: string) => string, clean: Clean): ValuePartHooks<string> => {
  const show = (value: unknown) => display(typeof value === "string" ? value : "");
  return { display: show, afterInput: (input, value, event) => replaceText(input, show(value), (typed) => clean(typed, typed), event) };
};

/**
 * Cleans a string field's value before the store takes it, so the store
 * only ever holds the clean value: `defineField(CodeInput, cleaned(upper))`.
 * A write above the field, such as a parent object or a reset, is cleaned
 * at the field too. The value already there is cleaned when the part
 * attaches, and so is its baseline while the field isn't dirty. Rebases
 * aren't cleaned, and a value that isn't a string is left alone.
 */
export const cleaned = (clean: Clean): Part<never, string> => part<string>(cleaning(clean));

/**
 * Shows a string field's value as `display` gives it in text inputs, and
 * keeps the caret in place as the user types. `clean` is how the field
 * cleans typed text, which places the caret. Without it the text is kept as
 * typed.
 */
export const displayed = (display: (value: string) => string, clean: Clean = keep): Part<never, string> =>
  part<string>(displaying(display, clean));

/**
 * A mask for a string field type: `cleaned` and, with a `display`,
 * `displayed`, in one part, as
 * `defineField(PhoneInput, masked({ clean: digits, display: formatPhone }))`.
 * It needs no plugin.
 */
export const masked = ({ clean, display }: MaskConfig): Part<never, string> =>
  part<string>({ ...cleaning(clean), ...(display && displaying(display, clean)) });
