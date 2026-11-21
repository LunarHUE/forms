import type { Page } from "@playwright/test";

import { expect, hydrated, sidebar, test } from "./fixtures";

/*
 * Client-side navigation (Astro's ClientRouter). A full load would reset
 * `window.docsLoaded`, so every test checks it survives: the page changed in
 * place.
 */

declare global {
  interface Window {
    docsLoaded?: boolean;
  }
}

async function markLoaded(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.docsLoaded = true;
  });
}

async function stillLoaded(page: Page): Promise<void> {
  expect(await page.evaluate(() => window.docsLoaded)).toBe(true);
}

/** The forms registered with the devtools hook right now. */
const registeredForms = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const hook = (globalThis as Record<symbol, { forms: Map<number, unknown> } | undefined>)[
      Symbol.for("lunarhue.forms.devtools")
    ];
    return hook?.forms.size ?? 0;
  });

/** Scrolls a demo into view and waits for its frame and form islands. */
async function demoReady(page: Page, name: string): Promise<void> {
  const demo = page.locator(`[data-demo="${name}"]`);
  await demo.scrollIntoViewIfNeeded();
  await hydrated(page, `[data-demo="${name}"] [data-demo-live] astro-island`);
}

for (const framework of ["react", "solid"] as const) {
  test(`${framework}: demos and the devtools follow the page across navigations`, async ({ page }) => {
    await page.goto(`/${framework}/plugins/masks`);
    await demoReady(page, "masks/contact");
    await markLoaded(page);
    await expect(page.getByRole("button", { name: "Select form contact" })).toBeVisible();
    expect(await registeredForms(page)).toBe(1);

    await sidebar(page).getByRole("link", { name: "History" }).click();
    await page.waitForURL(`**/${framework}/plugins/history`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("History");
    await stillLoaded(page);

    // The old page's form left the devtools, the new one joined.
    await demoReady(page, "history/note");
    await expect(page.getByRole("button", { name: "Select form note" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Select form contact" })).toHaveCount(0);
    expect(await registeredForms(page)).toBe(1);
    await expect(page.locator("[data-lunarhue-forms-devtools]")).toHaveCount(1);

    // The new demo works.
    const note = page.locator('[data-demo="history/note"]').getByRole("textbox").first();
    await note.fill("hello");
    await expect(note).toHaveValue("hello");

    // Back to masks: its demo mounts again from scratch.
    await page.goBack();
    await page.waitForURL(`**/${framework}/plugins/masks`);
    await demoReady(page, "masks/contact");
    await stillLoaded(page);
    const phone = page.locator('[data-demo="masks/contact"]').getByRole("textbox");
    await phone.pressSequentially("5551234567");
    await expect(phone).toHaveValue("(555) 123-4567");
    expect(await registeredForms(page)).toBe(1);
  });
}

test("the header and sidebar persist, and the sidebar mark moves", async ({ page }) => {
  await page.goto("/react/plugins/masks");
  await hydrated(page, "astro-island:has([aria-label='Forms devtools'])");
  await markLoaded(page);
  const header = await page.locator("astro-island:has([aria-label='Forms devtools'])").elementHandle();
  const nav = sidebar(page).locator("[data-sidebar-scroll]");
  await nav.evaluate((element) => element.scrollTo(0, 250));
  const scroll = await nav.evaluate((element) => element.scrollTop);
  expect(scroll).toBe(250);

  await sidebar(page).getByRole("link", { name: "Dirty" }).click();
  await page.waitForURL("**/react/plugins/dirty");
  await stillLoaded(page);

  // Same island element, same scroll, mark on the new page only.
  expect(
    await page.evaluate(
      (old) => old === document.querySelector("astro-island:has([aria-label='Forms devtools'])"),
      header,
    ),
  ).toBe(true);
  expect(await nav.evaluate((element) => element.scrollTop)).toBe(scroll);
  const current = sidebar(page).locator('a[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("href", "/react/plugins/dirty");
});

test("settings stay applied after a navigation", async ({ page }) => {
  await page.goto("/react/plugins/masks");
  await hydrated(page, 'astro-island:has([aria-label="Theme"])');
  await page.getByRole("button", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await markLoaded(page);

  await sidebar(page).getByRole("link", { name: "Install" }).click();
  await page.waitForURL("**/react/install");
  await stillLoaded(page);
  const html = page.locator("html");
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-framework", "react");
});

test("the framework picker swaps to the other framework's page in place", async ({ page }) => {
  await page.goto("/react/plugins/masks");
  await demoReady(page, "masks/contact");
  await hydrated(page, "[data-sidebar] astro-island");
  await markLoaded(page);

  await sidebar(page).getByRole("combobox").click();
  await page.getByRole("option", { name: "Solid" }).click();
  await page.waitForURL("**/solid/plugins/masks");
  await stillLoaded(page);
  await expect(page.locator("html")).toHaveAttribute("data-framework", "solid");
  await demoReady(page, "masks/contact");
  const phone = page.locator('[data-demo="masks/contact"]').getByRole("textbox");
  await phone.pressSequentially("5551234567");
  await expect(phone).toHaveValue("(555) 123-4567");
  expect(await registeredForms(page)).toBe(1);
});

test("On this page follows the new page, and hash links scroll to their heading", async ({ page }) => {
  await page.goto("/react/plugins/masks");
  await hydrated(page, "astro-island:has(#toc-label)");
  await markLoaded(page);

  await sidebar(page).getByRole("link", { name: "Dirty" }).click();
  await page.waitForURL("**/react/plugins/dirty");
  await stillLoaded(page);
  // A new page starts at the top.
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await hydrated(page, "astro-island:has(#toc-label)");
  const toc = page.getByRole("navigation", { name: "On this page" });
  await expect(toc.getByRole("link").first()).toHaveText("Dirty");

  const second = toc.getByRole("link").nth(1);
  const slug = (await second.getAttribute("href"))!.slice(1);
  await second.click();
  await expect(page).toHaveURL(new RegExp(`#${slug}$`));
  await expect(page.locator(`[id="${slug}"]`)).toBeInViewport();
  await expect(toc.locator('a[aria-current="location"]')).toHaveAttribute("href", `#${slug}`);
  await stillLoaded(page);
});

test("search opens after a navigation", async ({ page }) => {
  await page.goto("/react/plugins/masks");
  await hydrated(page, "astro-island:has([aria-label='Forms devtools'])");
  await markLoaded(page);
  await sidebar(page).getByRole("link", { name: "Install" }).click();
  await page.waitForURL("**/react/install");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await stillLoaded(page);
});

test("fonts and the stylesheet load once", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (["font", "stylesheet"].includes(request.resourceType())) requests.push(request.url());
  });
  await page.goto("/react/plugins/masks");
  await page.evaluate(() => document.fonts.ready);
  const first = requests.length;
  await sidebar(page).getByRole("link", { name: "Install" }).click();
  await page.waitForURL("**/react/install");
  await page.evaluate(() => document.fonts.ready);
  const fonts = requests.slice(first).filter((url) => /\.woff2?($|\?)/.test(url));
  expect(fonts).toEqual([]);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a link in the drawer navigates in place and closes the drawer", async ({ page }) => {
    await page.goto("/react/plugins/masks");
    await hydrated(page, 'astro-island:has([aria-label="Open navigation"])');
    await markLoaded(page);
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("link", { name: "Dirty" }).click();
    await page.waitForURL("**/react/plugins/dirty");
    await expect(drawer).toBeHidden();
    await stillLoaded(page);

    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(drawer.locator('a[aria-current="page"]')).toHaveAttribute("href", "/react/plugins/dirty");
  });
});
