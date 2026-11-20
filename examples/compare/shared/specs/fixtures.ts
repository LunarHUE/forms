import { test as base, type Page } from "@playwright/test";
import type { AppName, LibraryName } from "../../apps.ts";

export interface Options {
  /** The library the project's builds use. */
  readonly library: LibraryName;
}

export const test = base.extend<Options & { open: (app: AppName) => Promise<Page> }>({
  library: ["lunarhue", { option: true }],
  open: async ({ page, library }, use) => {
    await use(async (app) => {
      await page.goto(`/${app}/${library}/`);
      return page;
    });
  },
});

export { expect } from "@playwright/test";
