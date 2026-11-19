import type { Locator, Page } from "@playwright/test";
import { arraysScenario as scenario } from "../contract/index.js";
import { describedBy, expect, input, open, probe, test } from "./fixtures.js";

const { labels, errors } = scenario;

const member = (page: Page, index: number): Locator => input(page, labels.member(index));
const button = (page: Page, label: string): Locator => page.getByRole("button", { name: label, exact: true });

/** Tags an element with a marker that only that DOM node carries. */
async function tag(locator: Locator, marker: string): Promise<void> {
  await locator.evaluate((element, value) => {
    element.setAttribute("data-marker", value);
  }, marker);
}

const memberValues = async (page: Page): Promise<unknown> => (await probe(page)).value;

test.beforeEach(async ({ page }) => {
  await open(page, "arrays");
});

test("push adds an empty row at the end", async ({ page }) => {
  await button(page, labels.add).click();
  await expect(member(page, 2)).toHaveValue("");
  await expect.poll(async () => (await probe(page)).keys["members"]).toHaveLength(3);
});

test("insert adds an empty row above and shifts the rest down", async ({ page }) => {
  await tag(member(page, 0), "babbage");
  await button(page, labels.insertAbove(0)).click();
  await expect(member(page, 0)).toHaveValue("");
  await expect(member(page, 1)).toHaveValue("Charles Babbage");
  await expect(member(page, 1)).toHaveAttribute("data-marker", "babbage");
  await expect
    .poll(() => memberValues(page))
    .toEqual({ members: [{ name: "" }, { name: "Charles Babbage" }, { name: "Mary Somerville" }] });
});

test("removing the first row shifts the second up, keeping its input", async ({ page }) => {
  await tag(member(page, 1), "somerville");
  const keys = (await probe(page)).keys["members"];
  await button(page, labels.remove(0)).click();
  await expect(member(page, 0)).toHaveValue("Mary Somerville");
  await expect(member(page, 0)).toHaveAttribute("data-marker", "somerville");
  await expect(member(page, 1)).toHaveCount(0);
  await expect.poll(async () => (await probe(page)).keys["members"]).toEqual(keys?.slice(1));
});

test("moving a row keeps its input and its key", async ({ page }) => {
  await tag(member(page, 1), "somerville");
  const keys = (await probe(page)).keys["members"] ?? [];
  await button(page, labels.moveUp(1)).click();
  await expect(member(page, 0)).toHaveValue("Mary Somerville");
  await expect(member(page, 0)).toHaveAttribute("data-marker", "somerville");
  await expect.poll(async () => (await probe(page)).keys["members"]).toEqual(keys.toReversed());
  await button(page, labels.moveDown(0)).click();
  await expect(member(page, 1)).toHaveAttribute("data-marker", "somerville");
  await expect.poll(async () => (await probe(page)).keys["members"]).toEqual(keys);
});

test("moving a row keeps its focus", async ({ page }) => {
  const second = member(page, 1);
  await tag(second, "somerville");
  await second.focus();
  // A dispatched click runs the handler without moving focus to the button.
  await button(page, labels.moveUp(1)).dispatchEvent("click");
  await expect(member(page, 0)).toHaveAttribute("data-marker", "somerville");
  await expect(member(page, 0)).toBeFocused();
  await button(page, labels.moveDown(0)).dispatchEvent("click");
  await expect(member(page, 1)).toHaveAttribute("data-marker", "somerville");
  await expect(member(page, 1)).toBeFocused();
});

test("a row's error moves with the row", async ({ page }) => {
  const second = member(page, 1);
  await second.fill("");
  await second.blur();
  await expect(await describedBy(page, second)).toHaveText(errors.name);
  await button(page, labels.moveUp(1)).click();
  const first = member(page, 0);
  await expect(first).toHaveAttribute("aria-invalid", "true");
  await expect(await describedBy(page, first)).toHaveText(errors.name);
  await expect(member(page, 1)).not.toHaveAttribute("aria-invalid", "true");
  await expect.poll(async () => (await probe(page)).fields["members.0.name"]?.shown).toEqual([errors.name]);
});

test("typing in a new row and saving sends every row", async ({ page }) => {
  await button(page, labels.add).click();
  await member(page, 2).fill("Ada Lovelace");
  await page.getByRole("button", { name: scenario.submit.idle }).click();
  await expect(page.getByRole("status")).toHaveText("Saved 3 members.");
});
