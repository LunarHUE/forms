import type { Locator, Page } from "@playwright/test";
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

/** Where an input's caret is. */
const caret = (field: Locator) => field.evaluate((element: HTMLInputElement) => element.selectionStart);

/** Focuses an input and selects from `start` to `end`, or puts the caret at `start`. */
const select = (field: Locator, start: number, end = start) =>
  field.evaluate(
    (element: HTMLInputElement, [from, to]) => {
      element.focus();
      element.setSelectionRange(from, to);
    },
    [start, end] as const,
  );

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

  /** Opens the page with "(555) 123-4" in the phone input. */
  async function phoneWith7Digits(page: Page): Promise<Locator> {
    await open(page, "mask");
    const phone = input(page, labels.phone);
    await phone.fill("5551234");
    await expect(phone).toHaveValue("(555) 123-4");
    return phone;
  }

  test("typing in the middle keeps the caret after the typed digit", async ({ page }) => {
    const phone = await phoneWith7Digits(page);
    await select(phone, 7);
    await page.keyboard.type("9");
    await expect(phone).toHaveValue("(555) 192-34");
    expect(await caret(phone)).toBe(8);
    await page.keyboard.type("8");
    await expect(phone).toHaveValue("(555) 198-234");
    expect(await caret(phone)).toBe(10);
    await expect.poll(async () => (await probe(page)).value).toEqual({ phone: "555198234" });
  });

  test("backspace just after an inserted character steps back across it", async ({ page }) => {
    const phone = await phoneWith7Digits(page);
    await select(phone, 10);
    await page.keyboard.press("Backspace");
    await expect(phone).toHaveValue("(555) 123-4");
    expect(await caret(phone)).toBe(9);
    await page.keyboard.press("Backspace");
    await expect(phone).toHaveValue("(555) 124");
    expect(await caret(phone)).toBe(8);
    await select(phone, 6);
    await page.keyboard.press("Backspace");
    await expect(phone).toHaveValue("(555) 124");
    expect(await caret(phone)).toBe(4);
    await expect.poll(async () => (await probe(page)).value).toEqual({ phone: "555124" });
  });

  test("forward delete before an inserted character steps over it", async ({ page }) => {
    const phone = await phoneWith7Digits(page);
    await select(phone, 9);
    await page.keyboard.press("Delete");
    await expect(phone).toHaveValue("(555) 123-4");
    expect(await caret(phone)).toBe(10);
    await page.keyboard.press("Delete");
    await expect(phone).toHaveValue("(555) 123");
    await expect.poll(async () => (await probe(page)).value).toEqual({ phone: "555123" });
  });

  test("typing over a selection puts the caret after the typed digit", async ({ page }) => {
    const phone = await phoneWith7Digits(page);
    await select(phone, 6, 9);
    await page.keyboard.type("7");
    await expect(phone).toHaveValue("(555) 74");
    expect(await caret(phone)).toBe(7);
    await expect.poll(async () => (await probe(page)).value).toEqual({ phone: "55574" });
  });

  test("a paste puts the caret after the pasted digits", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const phone = await phoneWith7Digits(page);
    await page.evaluate(() => navigator.clipboard.writeText("8-8"));
    await select(phone, 6);
    await page.keyboard.press("ControlOrMeta+V");
    await expect(phone).toHaveValue("(555) 881-234");
    expect(await caret(phone)).toBe(8);
    await expect.poll(async () => (await probe(page)).value).toEqual({ phone: "555881234" });
  });

  test("a rejected character leaves the text and the caret as they were", async ({ page }) => {
    const phone = await phoneWith7Digits(page);
    await select(phone, 6);
    await page.keyboard.type("a");
    await expect(phone).toHaveValue("(555) 123-4");
    expect(await caret(phone)).toBe(6);
    await page.keyboard.type("9");
    await expect(phone).toHaveValue("(555) 912-34");
    expect(await caret(phone)).toBe(7);
    await expect.poll(async () => (await probe(page)).value).toEqual({ phone: "55591234" });
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
