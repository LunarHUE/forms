import type { Page } from "@playwright/test";

import { expect, hydrated, test } from "./fixtures";

/** Opens a comparison page and waits until its block has hydrated. */
async function openCompare(page: Page, app: string) {
  await page.goto(`/react/compared/${app}`);
  const block = page.locator(`[data-demo="compare/${app}"]`);
  await block.scrollIntoViewIfNeeded();
  await hydrated(page, `astro-island:has([data-demo="compare/${app}"])`);
  return block;
}

test("the sign-in comparison switches builds, their code and resets", async ({ page }) => {
  const block = await openCompare(page, "login");
  const library = block.getByRole("group", { name: "Library" });
  const ours = library.getByRole("button", { name: /@lunarhue\/forms/ });
  const theirs = library.getByRole("button", { name: /TanStack Form/ });
  const stage = block.locator(".compare-app");

  await expect(ours).toHaveAttribute("aria-pressed", "true");
  await expect(stage).toHaveAttribute("data-library", "lunarhue");
  const email = block.getByLabel("Email");
  await email.fill("ada@example.com");

  const tabs = block.getByRole("tablist", { name: "Demo" }).getByRole("tab");
  await expect(tabs).toHaveText(["Preview", "App.tsx"]);
  await tabs.nth(1).click();
  await expect(block.locator("[id$=code-panel]")).toContainText("@lunarhue/forms-react/mini");

  // The open file follows the switch.
  await theirs.click();
  await expect(theirs).toHaveAttribute("aria-pressed", "true");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(block.locator("[id$=code-panel]")).toContainText("@tanstack/react-form");

  // The other build mounts fresh, in TanStack's colours.
  await tabs.nth(0).click();
  await expect(stage).toHaveAttribute("data-library", "tanstack");
  await expect(email).toHaveValue("");
  const submit = block.getByRole("button", { name: "Sign in" });
  await expect(submit).not.toHaveCSS("background-color", "rgb(24, 25, 28)");

  await email.fill("grace@example.com");
  await block.getByRole("button", { name: "Reset demo" }).click();
  await expect(email).toHaveValue("");
});

test("the sign-in comparison's sizes follow the compression tabs", async ({ page }) => {
  const block = await openCompare(page, "login");
  const forms = block.locator('[data-size-build="forms"]');
  const gzip = await forms.textContent();

  await block.getByRole("tablist", { name: "Compression" }).getByRole("tab", { name: "brotli" }).click();
  await expect(forms).not.toHaveText(gzip ?? "");
  await expect(forms).toContainText(/kB · \d+% (smaller|larger)/);
});

test("a comparison with several files falls back to App.tsx for a file the other build lacks", async ({ page }) => {
  const block = await openCompare(page, "backoffice");
  const tabs = block.getByRole("tablist", { name: "Demo" }).getByRole("tab");
  await tabs.filter({ hasText: "forms.ts" }).click();
  await expect(block.locator("[id$=code-panel]")).toContainText("createForms");

  await block.getByRole("group", { name: "Library" }).getByRole("button", { name: /TanStack Form/ }).click();
  await expect(tabs.filter({ hasText: "App.tsx" })).toHaveAttribute("aria-selected", "true");
  await expect(tabs.filter({ hasText: "forms.ts" })).toHaveCount(0);
});
