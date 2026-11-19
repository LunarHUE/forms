import { useSyncExternalStore } from "react";

import type { Framework } from "@/lib/frameworks";
import { getServerState, getState, subscribe, type PackageManager, type Theme } from "@/lib/store";

/*
 * React views of lib/store.ts. During hydration they return the server
 * default (`DEFAULT_STATE`), then the visitor's setting, so server and client
 * markup match. Change values with `setTheme`, `setPackageManager` and
 * `setFramework` from `@/lib/store`.
 */

/** The theme setting: light, dark or system. */
export const useTheme = (): Theme =>
  useSyncExternalStore(subscribe, () => getState().theme, () => getServerState().theme);

/** The package manager the install lines show. */
export const usePackageManager = (): PackageManager =>
  useSyncExternalStore(subscribe, () => getState().pm, () => getServerState().pm);

/** The framework of the last docs page opened, or null. */
export const useLastFramework = (): Framework | null =>
  useSyncExternalStore(subscribe, () => getState().framework, () => getServerState().framework);
