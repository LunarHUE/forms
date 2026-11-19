import { getState } from "@/lib/store";

/**
 * Whether the forms devtools are on for this visitor. The docs ship them in
 * production, so this reads the visitor's setting instead of NODE_ENV.
 *
 * Stands in for the devtools plugin's `enabled` option until the plugin
 * exists. Then the demos install it as `devtools({ enabled: devtoolsEnabled })`
 * and the dock goes away.
 */
export const devtoolsEnabled = (): boolean => getState().devtools;
