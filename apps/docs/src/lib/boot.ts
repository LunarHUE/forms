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
 *
 * Astro's client router replaces <html>'s attributes with the next page's
 * server defaults on every navigation, and runs this script only on a full
 * load. So it applies the settings again on `astro:after-swap`, before the
 * new page paints. The page's framework then comes from the new
 * html[data-framework], which Layout sets on framework pages.
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
  const media = matchMedia(config.darkQuery);
  // Reads the setting from <html> each time, so it also sees changes the store made.
  // Transitions are off for the flip, as in store.ts.
  const applyDark = (): void => {
    const current = root.dataset.theme;
    const dark = current === "dark" || (current === "system" && media.matches);
    if (root.classList.contains("dark") === dark) return;
    root.setAttribute("data-theme-switching", "");
    root.classList.toggle("dark", dark);
    getComputedStyle(root).getPropertyValue("color");
    requestAnimationFrame(() => root.removeAttribute("data-theme-switching"));
  };

  const apply = (framework: string | null): void => {
    root.dataset.theme = pick(read(config.keys.theme), config.themes) ?? "system";
    const pm = pick(read(config.keys.pm), config.packageManagers);
    if (pm) root.dataset.pm = pm;
    root.dataset.devtools = read(config.keys.devtools) === "off" ? "off" : "on";

    if (framework) {
      root.dataset.framework = framework;
      try {
        localStorage.setItem(config.keys.framework, framework);
      } catch {
        // Not remembered; `/` falls back to the default framework.
      }
    } else {
      const last = pick(read(config.keys.framework), config.frameworks);
      if (last) root.dataset.framework = last;
    }
    applyDark();
  };

  apply(pageFramework);
  media.addEventListener("change", applyDark);
  document.addEventListener("astro:after-swap", () => apply(root.getAttribute("data-framework")));
}
/* oxlint-enable unicorn/consistent-function-scoping */

/** The inline script text for Layout.astro. */
export const bootScript = (pageFramework: string | null): string =>
  `(${boot.toString()})(${JSON.stringify(BOOT_CONFIG)},${JSON.stringify(pageFramework)});`;
