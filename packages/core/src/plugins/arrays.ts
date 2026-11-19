import type { Plugin } from "../plugin.js";
import { createArrays } from "../store/arrays.js";
import { buildKeys } from "../store/baseline/keys.js";

const plugin: Plugin<undefined, "arrays"> = { name: "arrays", "~arrays": [createArrays, buildKeys] };

/**
 * Array commands as a plugin: `push`, `insert`, `remove` and `move`, with
 * item keys that follow the items. Install it in a form that changes the
 * length or order of an array: `createForms({ plugins: [arrays()] })`.
 *
 * Without it every array has the positional keys `k0`, `k1`, ..., which is
 * all `Items` needs to render one, and the commands throw in development and
 * do nothing in production.
 */
export function arrays(): Plugin<undefined, "arrays"> {
  return plugin;
}
