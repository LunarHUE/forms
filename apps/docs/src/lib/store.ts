import { FRAMEWORK_IDS, isFramework, type Framework } from "./frameworks";

/*
 * The visitor's settings: theme, package manager and last-used framework.
 *
 * A tiny external store without framework code, so React islands (through
 * `@/components/hooks/store`) and plain scripts can share it. Each change
 * writes localStorage, updates the attributes on <html> that CSS reads, and
 * notifies subscribers. Other tabs' changes arrive through the `storage`
 * event.
 *
 * The boot script in Layout.astro (lib/boot.ts) sets the same attributes
 * before first paint, so CSS never waits for this module:
 *
 *   html.dark                 dark theme in effect (resolved from `system` too)
 *   html[data-theme]          the setting: light | dark | system
 *   html[data-pm]             bun | npm | pnpm | yarn
 *   html[data-framework]      react | solid | vue, once known
 */

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const PACKAGE_MANAGERS = ["bun", "npm", "pnpm", "yarn"] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/** localStorage keys. */
export const STORAGE_KEYS = {
  theme: "forms:theme",
  pm: "forms:pm",
  framework: "forms:framework",
} as const;

export interface DocsState {
  readonly theme: Theme;
  readonly pm: PackageManager;
  /** The framework of the last docs page the visitor opened, or null before the first one. */
  readonly framework: Framework | null;
}

/** What the server renders and what a first visit starts with. */
export const DEFAULT_STATE: DocsState = { theme: "system", pm: "bun", framework: null };

/** Settings the boot script needs. It runs inline and can't import anything. */
export const BOOT_CONFIG = {
  keys: STORAGE_KEYS,
  themes: THEMES,
  packageManagers: PACKAGE_MANAGERS,
  frameworks: FRAMEWORK_IDS,
  darkQuery: "(prefers-color-scheme: dark)",
} as const;

const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);
const isPackageManager = (value: unknown): value is PackageManager =>
  PACKAGE_MANAGERS.includes(value as PackageManager);

// Storage can throw (blocked cookies, some private modes). Settings then live
// for the page only.
const readKey = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeKey = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisted; the in-memory state still changes.
  }
};

const readStorage = (): DocsState => {
  const theme = readKey(STORAGE_KEYS.theme);
  const pm = readKey(STORAGE_KEYS.pm);
  const framework = readKey(STORAGE_KEYS.framework);
  return {
    theme: isTheme(theme) ? theme : DEFAULT_STATE.theme,
    pm: isPackageManager(pm) ? pm : DEFAULT_STATE.pm,
    framework: framework !== null && isFramework(framework) ? framework : DEFAULT_STATE.framework,
  };
};

/** Whether `theme` shows dark right now. `system` follows the OS setting. */
export const isDark = (theme: Theme): boolean =>
  theme === "dark" ||
  (theme === "system" && typeof matchMedia === "function" && matchMedia(BOOT_CONFIG.darkQuery).matches);

/** Writes the state into the attributes listed at the top of this file. */
export const applyToDocument = (next: DocsState, root: HTMLElement = document.documentElement): void => {
  root.classList.toggle("dark", isDark(next.theme));
  root.dataset.theme = next.theme;
  root.dataset.pm = next.pm;
  if (next.framework) root.dataset.framework = next.framework;
};

let state: DocsState | undefined;
const listeners = new Set<() => void>();

const emit = (): void => {
  for (const listener of listeners) listener();
};

const onStorage = (event: StorageEvent): void => {
  // `key` is null when another tab clears storage.
  if (event.key !== null && !Object.values<string>(STORAGE_KEYS).includes(event.key)) return;
  state = readStorage();
  applyToDocument(state);
  emit();
};

/** The current state. Reads localStorage on first use; on the server it is always `DEFAULT_STATE`. */
export const getState = (): DocsState => {
  if (typeof window === "undefined") return DEFAULT_STATE;
  if (!state) {
    state = readStorage();
    window.addEventListener("storage", onStorage);
  }
  return state;
};

/** For `useSyncExternalStore`'s server snapshot. */
export const getServerState = (): DocsState => DEFAULT_STATE;

/** Calls `listener` after every change. Returns the unsubscribe function. */
export const subscribe = (listener: () => void): (() => void) => {
  getState();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Merges `patch` into the state, persists the changed keys and updates <html>. */
export const setState = (patch: Partial<DocsState>): void => {
  const current = getState();
  const next: DocsState = { ...current, ...patch };
  if (next.theme === current.theme && next.pm === current.pm && next.framework === current.framework) return;
  state = next;
  if (next.theme !== current.theme) writeKey(STORAGE_KEYS.theme, next.theme);
  if (next.pm !== current.pm) writeKey(STORAGE_KEYS.pm, next.pm);
  if (next.framework !== current.framework && next.framework) writeKey(STORAGE_KEYS.framework, next.framework);
  applyToDocument(next);
  emit();
};

export const setTheme = (theme: Theme): void => setState({ theme });
export const setPackageManager = (pm: PackageManager): void => setState({ pm });
export const setFramework = (framework: Framework): void => setState({ framework });

/** Test helper: forgets the cached state and listeners. */
export const resetStoreForTests = (): void => {
  if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  state = undefined;
  listeners.clear();
};
