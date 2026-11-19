import type { Plugin } from "../plugin.js";
import { createDirty } from "../store/dirty.js";

export { baselineOnSubmit } from "./baseline-on-submit.js";

const plugin: Plugin<undefined, "dirty"> = { name: "dirty", "~dirty": createDirty };

/**
 * Dirty tracking as a plugin: `dirty` on each field and on the form, the
 * comparison with the definition's and the shared `equals`, and
 * `store.changes()`. Install it to show what the user changed:
 * `createForms({ plugins: [dirty()] })`.
 *
 * Without it, reading `dirty`, calling `changes()` and giving `equals` are
 * type errors. At runtime `dirty` stays false, and `changes()` throws in
 * development and returns nothing in production. The baseline stays, so
 * reset, `rebase` and `bind` still work. `rebase` then compares by
 * `Object.is` alone.
 */
export function dirty(): Plugin<undefined, "dirty"> {
  return plugin;
}
