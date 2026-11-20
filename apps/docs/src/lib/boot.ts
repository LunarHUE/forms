import { BOOT_CONFIG } from "./store";

type BootConfig = typeof BOOT_CONFIG;

/*
 * Runs inline in <head> before first paint (see Layout.astro), so it is
 * serialized with `toString()`: it must not use anything from outside its own
 * body. Everything it needs comes in through `config`.
 *
 * Sets html.dark, data-theme, data-pm, data-framework and data-devtools the same way
 * `applyToDocument` in store.ts does, and keeps html.dark in step with the OS
 * while the theme is `system`, also on pages without islands.
 */
// The helpers stay inside `boot` because only its own body is serialized.
/* oxlint-disable unicorn/consistent-function-scoping */
export function boot(config: BootConfig, pageFramework: string | null): void {
  const root = document.documentElement;
  const read = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const pick = (value: string | null, allowed: readonly string[]): string | null =>
    value !== null && allowed.includes(value) ? value : null;

  const theme = pick(read(config.keys.theme), config.themes) ?? "system";
  root.dataset.theme = theme;
  const pm = pick(read(config.keys.pm), config.packageManagers);
  if (pm) root.dataset.pm = pm;
  root.dataset.devtools = read(config.keys.devtools) === "off" ? "off" : "on";

  if (pageFramework) {
    root.dataset.framework = pageFramework;
    try {
      localStorage.setItem(config.keys.framework, pageFramework);
    } catch {
      // Not remembered; `/` falls back to the default framework.
    }
  } else {
    const framework = pick(read(config.keys.framework), config.frameworks);
    if (framework) root.dataset.framework = framework;
  }

  const media = matchMedia(config.darkQuery);
  // Reads the setting from <html> each time, so it also sees changes the store made.
  const apply = (): void => {
    const current = root.dataset.theme;
    root.classList.toggle("dark", current === "dark" || (current === "system" && media.matches));
  };
  apply();
  media.addEventListener("change", apply);
}
/* oxlint-enable unicorn/consistent-function-scoping */

/** The inline script text for Layout.astro. */
export const bootScript = (pageFramework: string | null): string =>
  `(${boot.toString()})(${JSON.stringify(BOOT_CONFIG)},${JSON.stringify(pageFramework)});`;
