import type { Plugin, PluginMembers } from "@lunarhue/forms-core";

export { devtools, syncDevtools, type DevtoolsOptions } from "./devtools.js";

// The declarations bundle core's types, so a consumer's emitted declarations
// can name the type devtools() returns only through this entry.
export type { Plugin, PluginMembers };
