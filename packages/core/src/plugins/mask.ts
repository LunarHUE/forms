import type { HookPlugin } from "../plugin.js";
import { definePlugin } from "../plugins.js";

/** A cleaner for one field. It gets the value so far and the caller's original input. */
export type Mask = (value: unknown, input: unknown) => unknown;

/** Keeps the digits of a string. */
export const digits: Mask = (value) => (typeof value === "string" ? value.replace(/\D/g, "") : value);

/** Upper-cases a string. */
export const upper: Mask = (value) => (typeof value === "string" ? value.toUpperCase() : value);

/** Options for `mask`. */
export interface MaskOptions {
  /** The plugin name, so two masks can run side by side. Defaults to `"mask"`. */
  readonly name?: string;
  /** The plugins this one runs after. */
  readonly after?: readonly string[];
}

/**
 * Cleans the value written at each named field before the store takes it,
 * so the store only ever holds the clean value. `fields` maps a dotted
 * stable path, such as `"address.zip"`, to its `Mask`. Every write goes
 * through it, including resets and other plugins' writes.
 */
export function mask(fields: Readonly<Record<string, Mask>>, options: MaskOptions = {}): HookPlugin {
  return definePlugin({
    name: options.name ?? "mask",
    ...(options.after && { after: options.after }),
    setup: () => ({
      beforeWrite(write) {
        const clean = fields[write.path.join(".")];
        return clean ? clean(write.value, write.input) : write.value;
      },
    }),
  });
}
