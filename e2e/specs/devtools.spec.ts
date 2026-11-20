import type { Locator, Page } from "@playwright/test";
import { basicScenario, devtoolsParam, type ScenarioId, scenarios, testIds } from "../contract/index.js";
import { consoleProblems, expect, input, open, test } from "./fixtures.js";

// The apps install `devtools()` with an `enabled` that reads `?devtools`. They
// build in production, so these run the panel the way a production opt-in
// does. Playwright's locators reach into the panel's open shadow root.

/** The panel's host element on the page. */
const host = (page: Page): Locator => page.locator("[data-lunarhue-forms-devtools]");

/** A row of the Fields tab by its stable path. */
const row = (page: Page, path: readonly string[]): Locator => page.locator(`[data-path='${JSON.stringify(path)}']`);

/** Opens a scenario's page with the devtools on and waits for it to hydrate and for the panel. */
async function openWithDevtools(page: Page, id: ScenarioId): Promise<void> {
  const scenario = scenarios.find((entry) => entry.id === id);
  if (scenario === undefined) throw new Error(`No scenario "${id}".`);
  await page.goto(`${scenario.route}?${devtoolsParam}`);
  await expect(page.getByTestId(testIds.probe)).not.toBeEmpty();
  await expect(page.getByRole("toolbar", { name: "Forms devtools" })).toBeVisible();
}

test.describe("devtools", () => {
  test("the panel mounts only on an opted-in page, and Turn off devtools removes it", async ({ page }) => {
    const problems = consoleProblems(page);
    await open(page, "basic");
    await expect(host(page)).toHaveCount(0);
    await openWithDevtools(page, "basic");
    await expect(host(page)).toHaveCount(1);
    await page.getByRole("button", { name: "Devtools menu" }).click();
    await page.getByRole("menuitem", { name: "Turn off devtools" }).click();
    await expect(host(page)).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("pick mode outlines the form, and clicking the outline selects it", async ({ page }) => {
    await openWithDevtools(page, "basic");
    await page.getByRole("button", { name: "Pick a form on the page" }).click();
    const outline = page.getByRole("button", { name: /^Pick form / });
    await expect(outline).toHaveCount(1);
    await outline.click();
    await expect(outline).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Form .+\. Choose a form$/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Devtools fields" })).toBeVisible();
  });

  test("the Fields tab follows typing", async ({ page }) => {
    const { labels } = basicScenario;
    await openWithDevtools(page, "basic");
    await page.getByRole("tab", { name: "Fields" }).click();
    await expect(row(page, ["name"])).toContainText('"Ada Lovelace"');
    await input(page, labels.name).fill("Grace Hopper");
    await expect(row(page, ["name"])).toContainText('"Grace Hopper"');
    await expect(row(page, ["name"])).toContainText("edited");
    await input(page, labels.name).fill("");
    await input(page, labels.name).blur();
    await expect(row(page, ["name"])).toContainText("invalid");
    await expect(row(page, ["name"])).toContainText(basicScenario.errors.name);
  });
});
