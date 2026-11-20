import { devtools, syncDevtools } from "@lunarhue/forms-devtools";

import { getState, setDevtools, subscribe } from "@/lib/store";

/**
 * Whether the forms devtools are on for this visitor. The docs ship them in
 * production, so this reads the visitor's setting instead of NODE_ENV.
 */
export const devtoolsEnabled = (): boolean => getState().devtools;

// The header toggle and other tabs change the setting without a form write,
// so tell the devtools to read it again.
if (typeof window !== "undefined") subscribe(syncDevtools);

/**
 * The devtools every demo installs. The code view hides this wiring
 * (components/mdx/demo/devtools.ts), so readers see the plain example.
 * "Turn off devtools" in the panel turns the visitor's setting off, and the
 * header toggle turns it back on.
 */
export const docsDevtools = devtools({ enabled: devtoolsEnabled, onDisable: () => setDevtools(false) });
