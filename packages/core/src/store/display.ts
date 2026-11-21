import type { FieldDisplay, MetaHolder } from "../plugin.js";

/** The meta slot the parts code keeps a field's display in. No plugin can have this name. */
export const displaySlot = "~display";

/**
 * The display of the field whose snapshot is `source`: the `display` and
 * `afterInput` hooks of the first part there that has `display`, or
 * undefined. For the adapters' text pieces. Internal.
 */
export const displayOf = (source: MetaHolder): FieldDisplay | undefined =>
  // Only the parts code writes this slot, with these hooks.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  source.meta?.[displaySlot] as FieldDisplay | undefined;
