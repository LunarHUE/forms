import type { Page } from "@playwright/test";
import { rendersScenario as scenario } from "../contract/index.js";
import { expect, input, open, renders, test } from "./fixtures.js";

const { labels, counters, totals } = scenario;

/** Every counter on the page, by id. */
async function allCounts(page: Page): Promise<Record<string, number>> {
  const entries = await page
    .locator('[data-testid^="renders-"]')
    .evaluateAll((elements) =>
      elements.map((element) => [element.getAttribute("data-testid") ?? "", Number(element.textContent)] as const),
    );
  return Object.fromEntries(entries.map(([id, count]) => [id.replace(/^renders-/, ""), count]));
}

test.beforeEach(async ({ page }) => {
  await open(page, "renders");
});

test("every counter starts at 1 after hydration", async ({ page }) => {
  const counts = await allCounts(page);
  expect(Object.keys(counts).length).toBeGreaterThan(10);
  for (const [id, count] of Object.entries(counts)) expect(count, id).toBe(1);
});

test("typing in one field renders only that field", async ({ page, framework }) => {
  const name = input(page, labels.name);
  await name.click();
  await name.press("End");
  await name.pressSequentially(" Byron");
  await expect(name).toHaveValue("Ada Lovelace Byron");
  const counts = await allCounts(page);
  const typed = counts["customer.name"] ?? 0;
  if (framework.rerendersOnChange) expect(typed).toBeGreaterThan(1);
  else expect(typed).toBe(1);
  for (const [id, count] of Object.entries(counts)) {
    if (id !== "customer.name") expect(count, id).toBe(1);
  }
});

test("a new quantity renders that field and the totals, not the row", async ({ page, framework }) => {
  const quantity = input(page, labels.quantity(0));
  await quantity.fill("2");
  await expect(page.getByTestId(totals.line(0))).toHaveText("25.00");
  await expect(page.getByTestId(totals.order)).toHaveText("31.00");
  const counts = await allCounts(page);
  const moved = new Set(["lines.0.quantity", counters.lineTotal(0), counters.orderTotal]);
  for (const [id, count] of Object.entries(counts)) {
    if (moved.has(id) && framework.rerendersOnChange) expect(count, id).toBeGreaterThan(1);
    else expect(count, id).toBe(1);
  }
  expect(await renders(page, counters.row(0))).toBe(1);
  expect(await renders(page, counters.page)).toBe(1);
});
