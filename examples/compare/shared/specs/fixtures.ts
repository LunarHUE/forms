import { test as base, type Page } from "@playwright/test";
import { type AppName, apps, type LibraryName, librariesOf } from "../../apps.ts";

export interface Options {
  /** The library the project's builds use. */
  readonly library: LibraryName;
}

export const test = base.extend<Options & { open: (app: AppName) => Promise<Page> }>({
  library: ["lunarhue", { option: true }],
  open: async ({ page, library }, use) => {
    await use(async (app) => {
      const built = apps.find((entry) => entry.name === app);
      base.skip(built === undefined || !librariesOf(built).some((entry) => entry.name === library), `${app} has no ${library} build yet.`);
      await page.goto(`/${app}/${library}/`);
      return page;
    });
  },
});

export { expect } from "@playwright/test";
