import type { Part, Plugin, PluginContext } from "../plugin.js";
import { defineHooks } from "../store/define.js";
import { createParts } from "../store/parts.js";
import { replaceText } from "./caret.js";

export { replaceText } from "./caret.js";

/** A cleaner for a string field. It gets the value so far and the caller's original input. */
export type Mask = (value: string, input: unknown) => string;

/** Keeps the digits of a string. */
export const digits: Mask = (value) => value.replace(/\D/g, "");

/** Upper-cases a string. */
export const upper: Mask = (value) => value.toUpperCase();

/** What `masked` takes: a field's cleaner and the text its inputs show. */
export interface MaskConfig {
  /** Cleans the value before the store takes it. */
  readonly clean: Mask;
  /**
   * The text a text input shows for the clean stored value, as
   * `(555) 123-4567` for `5551234567`. It must be a pure function of the
   * value. A value that isn't a string comes in as `""`.
   */
  readonly display?: (value: string) => string;
}

/**
 * The mask plugin. Put `mask()` in the form's plugins, and `masked(...)` on
 * the field types it cleans: `defineField(PhoneInput, masked({ clean, display }))`.
 *
 * Each field a masked field type renders, or a part pinned with `at`, gets
 * its value cleaned before the store takes it, so the store only ever holds
 * the clean value. A write above the field, such as a root replace, a
 * parent object or a reset, is cleaned at the field too. The field's value
 * is cleaned when the part attaches, and so is its baseline while the field
 * isn't dirty. Rebases are not cleaned: the incoming value is the server's
 * copy, and the baseline moves to it as it came. A value that isn't a
 * string is left alone.
 *
 * With a `display`, the adapters' text inputs show the display text and
 * keep the caret in place.
 */
export function mask(): Plugin<undefined, "mask"> {
  return defineHooks({
    name: "mask",
    attach(_ctx: PluginContext, { clean, display }: MaskConfig) {
      const run = (value: unknown, input: unknown) => (typeof value === "string" ? clean(value, input) : value);
      const text = (value: unknown) => (display ? display(typeof value === "string" ? value : "") : "");
      return {
        initial: (value) => run(value, value),
        beforeWrite: (write) => (write.cause === "rebase" ? write.value : run(write.value, write.input)),
        ...(display && {
          display: text,
          edit: (input, value, event) => replaceText(input, text(value), (typed) => run(typed, typed), event),
        }),
      };
    },
  }, { "~parts": createParts });
}

/** A mask for a string field type, as `defineField(PhoneInput, masked({ clean: digits, display: formatPhone }))`. Needs `mask()`. */
export const masked = (config: MaskConfig): Part<"mask", string> => ({ plugin: "mask", config });
