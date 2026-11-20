import type { Locator, Page } from "@playwright/test";
import { basicScenario, devtoolsParam, inspectScenario, type ScenarioId, scenarios, testIds } from "../contract/index.js";
import { consoleProblems, expect, input, open, test } from "./fixtures.js";

// The apps install `devtools()` with an `enabled` that reads `?devtools`. They
// build in production, so these run the panel the way a production opt-in
// does. Playwright's locators reach into the panel's open shadow root.

/** The panel's host element on the page. */
const host = (page: Page): Locator => page.locator("[data-lunarhue-forms-devtools]");

/** A row of the Fields tab by its stable path. */
const row = (page: Page, path: readonly string[]): Locator => page.locator(`[data-path='${JSON.stringify(path)}']`);

/** The hover card for the field named `name`. */
const card = (page: Page, name: string): Locator => page.getByRole("region", { name: `Field ${name}` });

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

  test("the hover card finds a radio group's field from either radio, and a click pins it", async ({ page }) => {
    const { labels } = inspectScenario;
    await openWithDevtools(page, "inspect");
    await page.getByRole("button", { name: "Inspect fields on the page" }).click();
    await page.getByLabel(labels.pro).hover();
    await expect(card(page, "plan")).toContainText('"free"');
    await page.getByLabel(labels.free).hover();
    await expect(card(page, "plan")).toBeVisible();
    await expect(page.locator(".outline.field")).toHaveCount(2);
    // The click pins the card and never reaches the radio.
    await page.getByLabel(labels.pro).click();
    await expect(page.getByRole("button", { name: "Unpin the field card" })).toBeVisible();
    await expect(page.getByLabel(labels.pro)).not.toBeChecked();
    await expect(row(page, ["plan"])).toHaveAttribute("aria-current", "true");
    await page.getByRole("button", { name: "Unpin the field card" }).click();
    await expect(card(page, "plan")).toHaveCount(0);
  });

  test("holding Alt shows the hover card for a custom input that records itself with a field ref", async ({ page }) => {
    const { labels } = inspectScenario;
    await openWithDevtools(page, "inspect");
    const meter = page.getByRole("meter", { name: labels.rating });
    await page.keyboard.down("Alt");
    await meter.hover();
    await expect(card(page, "rating")).toContainText("3");
    await page.keyboard.up("Alt");
    await expect(card(page, "rating")).toHaveCount(0);
    // With Alt up the page gets its clicks, and the card would follow the value.
    await page.getByRole("button", { name: labels.raise }).click();
    await expect(meter).toHaveText("4");
    await page.keyboard.down("Alt");
    await meter.hover({ position: { x: 1, y: 1 } });
    await expect(card(page, "rating")).toContainText("4");
    await page.keyboard.up("Alt");
  });

  test("hovering a row of the Fields tab outlines the field's elements", async ({ page }) => {
    await openWithDevtools(page, "inspect");
    await page.getByRole("tab", { name: "Fields" }).click();
    await row(page, ["plan"]).hover();
    await expect(page.locator(".outline.field")).toHaveCount(2);
    await row(page, ["rating"]).hover();
    await expect(page.locator(".outline.field")).toHaveCount(1);
    await page.mouse.move(0, 0);
    await expect(page.locator(".outline.field")).toHaveCount(0);
  });
});
