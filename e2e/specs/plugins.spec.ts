import type { Page } from "@playwright/test";
import { bindScenario, historyScenario, maskScenario, persistScenario } from "../contract/index.js";
import { expect, input, open, probe, test } from "./fixtures.js";

/** The bind page's outside store, as the probe shows it. */
const outside = async (page: Page): Promise<unknown> => (await probe(page)).sources["outside"];

test.describe("history", () => {
  const { labels } = historyScenario;

  test("undo and redo step through edits", async ({ page }) => {
    await open(page, "history");
    const undo = page.getByRole("button", { name: labels.undo });
    const redo = page.getByRole("button", { name: labels.redo });
    const title = input(page, labels.title);
    const body = input(page, labels.body);
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();
    await title.fill("Hello");
    await body.fill("World");
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(body).toHaveValue("");
    await expect(title).toHaveValue("Hello");
    await expect(redo).toBeEnabled();
    await undo.click();
    await expect(title).toHaveValue("");
    await expect(undo).toBeDisabled();
    await redo.click();
    await redo.click();
    await expect(title).toHaveValue("Hello");
    await expect(body).toHaveValue("World");
    await expect(redo).toBeDisabled();
    await expect.poll(async () => (await probe(page)).value).toEqual({ title: "Hello", body: "World" });
  });
});

test.describe("mask", () => {
  const { labels } = maskScenario;

  test("the store keeps digits and the input shows them formatted", async ({ page }) => {
    await open(page, "mask");
    const phone = input(page, labels.phone);
    expect((await probe(page)).value).toEqual({ phone: "5550001111" });
    await phone.fill("555-123-4567");
    await expect(phone).toHaveValue("(555) 123-4567");
    await expect.poll(async () => (await probe(page)).value).toEqual({ phone: "5551234567" });
    await page.getByRole("button", { name: maskScenario.submit.idle }).click();
    await expect(page.getByRole("status")).toHaveText("Saved 5551234567.");
  });
});

test.describe("persist", () => {
  const { labels, storageKey } = persistScenario;

  test("a draft survives a reload, and discarding it clears it", async ({ page }) => {
    await open(page, "persist");
    await input(page, labels.subject).fill("Broken link");
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
      .toContain("Broken link");
    await page.reload();
    await expect(page.getByTestId("probe")).not.toBeEmpty();
    await expect(input(page, labels.subject)).toHaveValue("Broken link");
    await page.getByRole("button", { name: labels.discard }).click();
    await expect(input(page, labels.subject)).toHaveValue("");
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
      .not.toContain("Broken link");
    await page.reload();
    await expect(page.getByTestId("probe")).not.toBeEmpty();
    await expect(input(page, labels.subject)).toHaveValue("");
  });
});

test.describe("bind", () => {
  const { labels, freshProfile } = bindScenario;

  test.beforeEach(async ({ page }) => {
    await open(page, "bind");
  });

  test("typing in the form updates the store", async ({ page }) => {
    await input(page, labels.name).fill("Ada Byron");
    await input(page, labels.city).fill("Ockham");
    const expected = { name: "Ada Byron", email: "ada@example.com", city: "Ockham" };
    await expect.poll(() => outside(page)).toEqual({ profile: expected, theme: "light" });
    expect((await probe(page)).value).toEqual(expected);
  });

  test("a change to the store shows in the form", async ({ page }) => {
    await page.getByRole("button", { name: labels.change }).click();
    await expect(input(page, labels.name)).toHaveValue("Grace Hopper");
    await expect(input(page, labels.email)).toHaveValue("grace@example.com");
    await expect(input(page, labels.city)).toHaveValue("London");
  });

  test("a rebase keeps the edited field and takes the rest, and the store gets the result", async ({ page }) => {
    await input(page, labels.name).fill("Ada Byron");
    await page.getByRole("button", { name: labels.refresh }).click();
    await expect(input(page, labels.email)).toHaveValue(freshProfile.email);
    await expect(input(page, labels.city)).toHaveValue(freshProfile.city);
    await expect(input(page, labels.name)).toHaveValue("Ada Byron");
    const merged = { ...freshProfile, name: "Ada Byron" };
    await expect.poll(() => outside(page)).toEqual({ profile: merged, theme: "light" });
    const state = await probe(page);
    expect(state.value).toEqual(merged);
    // The fresh values are the new baseline, so only the kept edit is dirty.
    expect(state.fields["email"]?.edited).toBe(false);
  });

  test("a submit saves", async ({ page }) => {
    await page.getByRole("button", { name: bindScenario.submit.idle }).click();
    await expect(page.getByRole("status")).toHaveText("Saved Ada Lovelace (save 1).");
  });
});
