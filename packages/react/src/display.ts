import type { FieldDisplay } from "@lunarhue/forms-core";

const isDisplay = (meta: unknown): meta is FieldDisplay =>
  typeof meta === "object" && meta !== null && "display" in meta && typeof meta.display === "function";

/** The first slot of a field's meta that is a `FieldDisplay`, which changes what a text input shows. */
export const displayOf = (meta: Readonly<Record<string, unknown>> | undefined): FieldDisplay | undefined =>
  meta && Object.values(meta).find(isDisplay);
