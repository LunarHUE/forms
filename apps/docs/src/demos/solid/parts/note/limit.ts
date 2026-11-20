import type { Part, PluginContext } from "@lunarhue/forms-solid";
import { definePlugin } from "@lunarhue/forms-solid/plugins";

interface Limit {
  readonly max: number;
}

// The plugin. `attach` runs once for each field a `limited` part lands on.
export const limit = () =>
  definePlugin({
    name: "limit",
    attach: (_ctx: PluginContext, { max }: Limit) => ({
      beforeWrite: (write) => (typeof write.value === "string" ? write.value.slice(0, max) : write.value),
    }),
  });

// The part. It fits string fields only and needs limit() in the form's plugins.
export const limited = (max: number): Part<"limit", string> => ({ plugin: "limit", config: { max } });
