import type { Locator } from "@playwright/test";
import { scenarios, testIds } from "../contract/index.js";
import { consoleProblems, expect, input, open, test } from "./fixtures.js";

/** True when an input says it is read-only: `readonly` on a text input, `aria-readonly` on a checkbox. */
const readOnlyMark = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => element.hasAttribute("readonly") || element.getAttribute("aria-readonly") === "true");

// Every scenario, rendered on the server and then hydrated.

test.describe("before any script runs", () => {
  test.use({ javaScriptEnabled: false });

  for (const scenario of scenarios) {
    test(`${scenario.id}: the server HTML has the values and flags`, async ({ page }) => {
      await page.goto(scenario.route);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(scenario.title);
      const { values = {}, checked = [], disabled = [], readOnly = [], absent = [] } = scenario.server;
      for (const [label, value] of Object.entries(values)) await expect(input(page, label)).toHaveValue(value);
      for (const label of checked) await expect(input(page, label)).toBeChecked();
      for (const label of disabled) await expect(input(page, label)).toBeDisabled();
      for (const label of readOnly) expect(await readOnlyMark(input(page, label)), label).toBe(true);
      for (const label of absent) await expect(input(page, label)).toHaveCount(0);
      // The probe fills only once the page is live.
      await expect(page.getByTestId(testIds.probe)).toBeEmpty();
    });
  }
});

for (const scenario of scenarios) {
  test(`${scenario.id}: hydrates with no console error or warning`, async ({ page }) => {
    const problems = consoleProblems(page);
    await open(page, scenario.id);
    // Let any error reported after the hydrating render arrive first.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))));
    expect(problems).toEqual([]);
    // Hydration kept the server's values.
    for (const [label, value] of Object.entries(scenario.server.values ?? {})) {
      await expect(input(page, label)).toHaveValue(value);
    }
  });
}

test("the index links every scenario", async ({ page }) => {
  await page.goto("/");
  for (const scenario of scenarios) {
    await expect(page.getByRole("link", { name: scenario.title, exact: true })).toHaveAttribute("href", scenario.route);
  }
});

test("an unknown path is a 404", async ({ request }) => {
  const response = await request.get("/nowhere");
  expect(response.status()).toBe(404);
});
