import { expect, firstState, hydrated, recordDomContentLoaded, test } from "./fixtures";

test("picking a package manager switches every install line and survives a reload", async ({
  page,
  browser,
  context,
}) => {
  await recordDomContentLoaded(page);
  await page.goto("/react/install");
  const lines = page.locator("[data-install]");
  await expect(lines.first()).toBeVisible();
  await lines.last().scrollIntoViewIfNeeded();
  await hydrated(page, "astro-island:has([data-install])");

  await lines.first().getByRole("button", { name: "npm", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-pm", "npm");
  for (const line of await lines.all()) {
    await expect(line.locator('[data-pm-tab="npm"]')).toHaveAttribute("aria-pressed", "true");
    await expect(line.locator('[data-pm-command="npm"]')).toBeVisible();
    await expect(line.locator('[data-pm-command="bun"]')).toBeHidden();
  }

  await page.reload();
  expect((await firstState(page)).pm).toBe("npm");
  await expect(lines.first().locator('[data-pm-command="npm"]')).toBeVisible();

  // With no island code at all, the boot script alone picks the command.
  // A separate context, since the blocked scripts log errors.
  const bare = await browser.newContext({ storageState: await context.storageState(), colorScheme: "light" });
  const noScripts = await bare.newPage();
  await noScripts.route("**/_astro/*.js", (route) => route.abort());
  await noScripts.goto("/react/install");
  await expect(noScripts.locator("html")).toHaveAttribute("data-pm", "npm");
  await expect(noScripts.locator('[data-install] [data-pm-command="npm"]').first()).toBeVisible();
  await expect(noScripts.locator('[data-install] [data-pm-command="bun"]').first()).toBeHidden();
  await bare.close();
});

test("the dark theme survives a reload and applies before hydration", async ({ page }) => {
  await recordDomContentLoaded(page);
  await page.goto("/react/install");
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await hydrated(page, 'astro-island:has([aria-label="Theme"])');

  await page.getByRole("button", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload();
  const first = await firstState(page);
  expect(first.dark).toBe(true);
  expect(first.theme).toBe("dark");
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});

test("the devtools panel turns off from its menu, stays off after a reload and comes back from the header", async ({
  page,
}) => {
  await page.goto("/react/plugins/masks");
  // The panel mounts once a demo's form, which installs the devtools, hydrates.
  await page.locator('[data-demo="masks/contact"]').scrollIntoViewIfNeeded();
  const panel = page.getByRole("toolbar", { name: "Forms devtools" });
  const host = page.locator("[data-lunarhue-forms-devtools]");
  await expect(panel).toBeVisible();

  await panel.getByRole("button", { name: "Devtools menu" }).click();
  await page.getByRole("menuitem", { name: "Turn off devtools" }).click();
  await expect(host).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-devtools", "off");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-devtools", "off");
  await page.locator('[data-demo="masks/contact"]').scrollIntoViewIfNeeded();
  await hydrated(page, '[data-demo="masks/contact"] [data-demo-live] astro-island');
  await expect(host).toHaveCount(0);
  const toggle = page.getByRole("button", { name: "Forms devtools" });
  await hydrated(page, "astro-island:has([aria-label='Forms devtools'])");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(panel).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(host).toHaveCount(0);
});
