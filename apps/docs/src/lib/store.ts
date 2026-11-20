import { FRAMEWORK_IDS, isFramework, type Framework } from "./frameworks";

/*
 * The visitor's settings: theme, package manager, last-used framework and
 * whether the forms devtools are on.
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
 *   html[data-devtools]       on | off
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
  devtools: "forms:devtools",
} as const;

export interface DocsState {
  readonly theme: Theme;
  readonly pm: PackageManager;
  /** The framework of the last docs page the visitor opened, or null before the first one. */
  readonly framework: Framework | null;
  /** Whether the forms devtools show. On by default, in production too. */
  readonly devtools: boolean;
}

/** What the server renders and what a first visit starts with. */
export const DEFAULT_STATE: DocsState = { theme: "system", pm: "bun", framework: null, devtools: true };

/** Settings the boot script needs. It runs inline and can't import anything. */
export const BOOT_CONFIG = {
  keys: STORAGE_KEYS,
  themes: THEMES,
  packageManagers: PACKAGE_MANAGERS,
  frameworks: FRAMEWORK_IDS,
  darkQuery: "(prefers-color-scheme: dark)",
} as const;

const isTheme = (value: string | null): value is Theme => (THEMES as readonly (string | null)[]).includes(value);
const isPackageManager = (value: string | null): value is PackageManager =>
  (PACKAGE_MANAGERS as readonly (string | null)[]).includes(value);

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
  const devtools = readKey(STORAGE_KEYS.devtools);
  return {
    theme: isTheme(theme) ? theme : DEFAULT_STATE.theme,
    pm: isPackageManager(pm) ? pm : DEFAULT_STATE.pm,
    framework: framework !== null && isFramework(framework) ? framework : DEFAULT_STATE.framework,
    devtools: devtools === null ? DEFAULT_STATE.devtools : devtools !== "off",
  };
};

/** Whether `theme` shows dark right now. `system` follows the OS setting. */
export const isDark = (theme: Theme): boolean =>
  theme === "dark" ||
  (theme === "system" && typeof matchMedia === "function" && matchMedia(BOOT_CONFIG.darkQuery).matches);

/**
 * Flips html.dark with transitions off, so every colour changes in the same
 * frame instead of each element easing at its own speed. boot.ts does the
 * same for OS changes.
 */
const setDark = (root: HTMLElement, dark: boolean): void => {
  if (root.classList.contains("dark") === dark) return;
  root.setAttribute("data-theme-switching", "");
  root.classList.toggle("dark", dark);
  // Reading a style applies the new colours now, while transitions are off.
  getComputedStyle(root).getPropertyValue("color");
  const restore = () => root.removeAttribute("data-theme-switching");
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
  else setTimeout(restore, 0);
};

/** Writes the state into the attributes listed at the top of this file. */
export const applyToDocument = (next: DocsState, root: HTMLElement = document.documentElement): void => {
  setDark(root, isDark(next.theme));
  root.dataset.theme = next.theme;
  root.dataset.pm = next.pm;
  if (next.framework) root.dataset.framework = next.framework;
  root.dataset.devtools = next.devtools ? "on" : "off";
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

// A client-side navigation can change the last-used framework (the boot
// script saves the new page's), so read storage again after each swap.
const onSwap = (): void => {
  state = readStorage();
  emit();
};

/** The current state. Reads localStorage on first use; on the server it is always `DEFAULT_STATE`. */
export const getState = (): DocsState => {
  if (typeof window === "undefined") return DEFAULT_STATE;
  if (!state) {
    state = readStorage();
    window.addEventListener("storage", onStorage);
    document.addEventListener("astro:after-swap", onSwap);
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
  if (
    next.theme === current.theme &&
    next.pm === current.pm &&
    next.framework === current.framework &&
    next.devtools === current.devtools
  ) {
    return;
  }
  state = next;
  if (next.theme !== current.theme) writeKey(STORAGE_KEYS.theme, next.theme);
  if (next.pm !== current.pm) writeKey(STORAGE_KEYS.pm, next.pm);
  if (next.framework !== current.framework && next.framework) writeKey(STORAGE_KEYS.framework, next.framework);
  if (next.devtools !== current.devtools) writeKey(STORAGE_KEYS.devtools, next.devtools ? "on" : "off");
  applyToDocument(next);
  emit();
};

export const setTheme = (theme: Theme): void => setState({ theme });
export const setPackageManager = (pm: PackageManager): void => setState({ pm });
export const setFramework = (framework: Framework): void => setState({ framework });
export const setDevtools = (devtools: boolean): void => setState({ devtools });

/** Test helper: forgets the cached state and listeners. */
export const resetStoreForTests = (): void => {
  if (typeof window !== "undefined") {
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("astro:after-swap", onSwap);
  }
  state = undefined;
  listeners.clear();
};
