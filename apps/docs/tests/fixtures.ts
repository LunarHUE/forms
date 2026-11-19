import { test as base, expect, type Locator, type Page } from "@playwright/test";

/** What the page looked like when DOMContentLoaded fired, recorded by `recordDomContentLoaded`. */
export interface FirstState {
  readonly pm: string | undefined;
  readonly theme: string | undefined;
  readonly dark: boolean;
}

declare global {
  interface Window {
    docsFirstState?: FirstState;
  }
}

export const test = base.extend<{ consoleErrors: string[] }>({
  // Every test fails if a page it visits logs an error or throws.
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(`${page.url()}: ${message.text()}`);
      });
      page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Waits until the Astro islands that `selector` matches, at least one, have
 * hydrated. Astro drops their `ssr` attribute when they have.
 */
export async function hydrated(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector).first()).toBeAttached();
  await expect(page.locator(`${selector}[ssr]`)).toHaveCount(0);
}

/** Saves html's state at DOMContentLoaded on every load of the page, before islands hydrate. */
export async function recordDomContentLoaded(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        const root = document.documentElement;
        window.docsFirstState = {
          pm: root.dataset["pm"],
          theme: root.dataset["theme"],
          dark: root.classList.contains("dark"),
        };
      },
      { once: true },
    );
  });
}

export async function firstState(page: Page): Promise<FirstState> {
  await page.waitForFunction(() => window.docsFirstState !== undefined);
  const state = await page.evaluate(() => window.docsFirstState);
  if (state === undefined) throw new Error("DOMContentLoaded was not recorded.");
  return state;
}

/** The desktop sidebar of the page's framework. */
export const sidebar = (page: Page): Locator => page.locator("[data-sidebar]:visible");
