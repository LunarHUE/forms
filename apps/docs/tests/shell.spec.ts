import { expect, hydrated, sidebar, test } from "./fixtures";

for (const framework of ["react", "solid"] as const) {
  test(`/${framework}/install marks Install in the sidebar`, async ({ page }) => {
    await page.goto(`/${framework}/install`);
    await expect(page.locator("html")).toHaveAttribute("data-framework", framework);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const current = sidebar(page).locator('a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("href", `/${framework}/install`);
  });
}

test.describe("framework picker", () => {
  test("keeps the page when the other framework has it", async ({ page }) => {
    await page.goto("/react/plugins/masks");
    await hydrated(page, "[data-sidebar] astro-island");
    await sidebar(page).getByRole("combobox").click();
    await page.getByRole("option", { name: "Solid" }).click();
    await page.waitForURL("**/solid/plugins/masks");
    await expect(page.locator("html")).toHaveAttribute("data-framework", "solid");
  });

  test("falls back to the introduction when the other framework lacks the page", async ({ page }) => {
    await page.goto("/react/integrations/zustand");
    await hydrated(page, "[data-sidebar] astro-island");
    await sidebar(page).getByRole("combobox").click();
    await page.getByRole("option", { name: "Solid" }).click();
    await page.waitForURL("**/solid/introduction");
  });
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the drawer opens and closes", async ({ page }) => {
    await page.goto("/react/plugins/masks");
    await hydrated(page, 'astro-island:has([data-slot="sheet-trigger"])');
    const drawer = page.getByRole("dialog");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('a[aria-current="page"]')).toHaveAttribute("href", "/react/plugins/masks");
    await drawer.getByRole("button", { name: "Close navigation" }).click();
    await expect(drawer).toBeHidden();
  });

  test('"On this page" opens and closes', async ({ page }) => {
    await page.goto("/react/plugins/masks");
    await hydrated(page, 'astro-island:has([data-slot="collapsible"])');
    const toggle = page.getByRole("button", { name: "On this page" });
    const list = page.getByRole("navigation", { name: "On this page" });
    await expect(list).toBeHidden();
    await toggle.click();
    await expect(list).toBeVisible();
    await expect(list.getByRole("link").first()).toBeVisible();
    await toggle.click();
    await expect(list).toBeHidden();
  });
});

test("a moved page's old URL redirects to its new one", async ({ page }) => {
  await page.goto("/solid/concepts/fields");
  await page.waitForURL("**/solid/basics/fields");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
