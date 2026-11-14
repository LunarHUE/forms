import type { DirtyPlugin } from "../plugin.js";
import { createDirty } from "../store/dirty.js";

export { baselineOnSubmit } from "./baseline-on-submit.js";

const plugin: DirtyPlugin = { name: "dirty", dirty: createDirty };

/**
 * Dirty tracking as a plugin: `dirty` on each field and on the form, the
 * comparison with the definition's and the shared `equals`, and
 * `store.changes()`. Install it to show what the user changed:
 * `createForms({ plugins: [dirty()] })`.
 *
 * Without it `dirty` is always false, `changes()` is empty and `equals` is a
 * type error. The baseline stays, so reset, `rebase` and `bind` still work.
 * `rebase` then compares by `Object.is` alone.
 */
export function dirty(): DirtyPlugin {
  return plugin;
}
