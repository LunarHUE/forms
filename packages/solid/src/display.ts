import type { PluginHooks } from "@lunarhue/forms-core";

/** What changes the text a text input shows: the `display` and `edit` hooks of the first plugin attached at the field. */
export type FieldDisplay = Required<Pick<PluginHooks, "display">> & Pick<PluginHooks, "edit">;

/** The field's display, from the meta slot the plugin host keeps it in. */
export const displayOf = (meta: Readonly<Record<string, unknown>> | undefined): FieldDisplay | undefined =>
  // Only the host writes this slot, with these hooks.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  meta?.["~display"] as FieldDisplay | undefined;
