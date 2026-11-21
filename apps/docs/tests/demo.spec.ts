import type { Page, Response } from "@playwright/test";

import { expect, test } from "./fixtures";

const frameworks = ["react", "solid"] as const;
type Framework = (typeof frameworks)[number];

/** Opens the masks page and waits until its contact demo has hydrated. */
async function openMasks(page: Page, framework: Framework) {
  await page.goto(`/${framework}/plugins/masks`);
  const demo = page.locator('[data-demo="masks/contact"]');
  await demo.scrollIntoViewIfNeeded();
  await demoHydrated(page);
  return demo;
}

/** The demo frame and the form inside it have both hydrated. */
async function demoHydrated(page: Page): Promise<void> {
  await expect(page.locator('astro-island:has([data-demo="masks/contact"])')).not.toHaveAttribute("ssr");
  const form = page.locator('[data-demo="masks/contact"] [data-demo-live] astro-island');
  await expect(form).toHaveCount(1);
  await expect(form).not.toHaveAttribute("ssr");
}

for (const framework of frameworks) {
  test(`${framework}: the masks demo formats, shows its code and resets`, async ({ page }) => {
    const demo = await openMasks(page, framework);
    const phone = demo.getByRole("textbox");

    await phone.pressSequentially("5551234567");
    await expect(phone).toHaveValue("(555) 123-4567");

    const tabs = demo.getByRole("tablist", { name: "Demo" }).getByRole("tab");
    await expect(tabs).toHaveText(["Preview", "contact.tsx", "PhoneField.tsx"]);
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(demo.getByRole("tabpanel")).toContainText("export const PhoneField");
    await tabs.nth(0).click();
    // The preview stays mounted while the code shows.
    await expect(phone).toHaveValue("(555) 123-4567");

    await demo.getByRole("button", { name: "Reset demo" }).click();
    await demoHydrated(page);
    await expect(phone).toHaveValue("");
    await phone.pressSequentially("2125550100");
    await expect(phone).toHaveValue("(212) 555-0100");
  });
}

for (const framework of frameworks) {
  test(`${framework}: the devtools select the masks demo's form from its outline tag`, async ({ page }) => {
    const demo = await openMasks(page, framework);
    await page.getByRole("button", { name: "Select form contact" }).click();
    await expect(page.getByRole("button", { name: "Form contact. Choose a form" })).toBeVisible();

    // Selecting opens the Fields tab, which follows typing.
    await expect(page.getByRole("region", { name: "Devtools fields" })).toBeVisible();
    const phone = page.locator(`[data-path='["phone"]']`);
    await demo.getByRole("textbox").pressSequentially("555");
    await expect(phone).toContainText('"555"');
  });

  test(`${framework}: the demo code hides the devtools wiring`, async ({ page }) => {
    const demo = await openMasks(page, framework);
    await demo.getByRole("tab", { name: "contact.tsx" }).click();
    const code = demo.getByRole("tabpanel");
    await expect(code).toContainText("createForms({ fields: { PhoneField } })");
    await expect(code).toContainText('id: "contact"');
    await expect(code).not.toContainText("docsDevtools");
  });
}

/** Every script and document the page loads, with its body, after the demo has hydrated. */
async function scriptsOf(page: Page, framework: Framework) {
  const responses: Response[] = [];
  page.on("response", (response) => {
    const type = response.request().resourceType();
    if (type === "script" || type === "document") responses.push(response);
  });
  await openMasks(page, framework);
  await page.waitForLoadState("networkidle");
  const demoUrl = await page
    .locator('[data-demo="masks/contact"] [data-demo-live] astro-island')
    .getAttribute("component-url");
  if (demoUrl === null) throw new Error("The demo island has no component-url.");
  const scripts = await Promise.all(
    responses.map(async (response) => ({ path: new URL(response.url()).pathname, body: await response.text() })),
  );
  return { demoUrl, scripts };
}

// Solid's hydration code, in a chunk or inline in the page: `_$HY` holds the
// hydration state, `_hk` is its key attribute.
const solidRuntime = /_\$HY|\b_hk\b/;

test("a React page loads no Solid code and a Solid page no React demo", async ({ browser }) => {
  const reactPage = await browser.newPage();
  const solidPage = await browser.newPage();
  const react = await scriptsOf(reactPage, "react");
  const solid = await scriptsOf(solidPage, "solid");
  expect(react.demoUrl).not.toBe(solid.demoUrl);

  const reactPaths = react.scripts.map((script) => script.path);
  expect(reactPaths).toContain(react.demoUrl);
  expect(reactPaths).not.toContain(solid.demoUrl);
  expect(react.scripts.filter((script) => solidRuntime.test(script.body)).map((script) => script.path)).toEqual(
    [],
  );
  expect(react.scripts.some((script) => script.body.includes("hydrateRoot"))).toBe(true);

  // The shell is React, so a Solid page loads React too, just not the React demo.
  const solidPaths = solid.scripts.map((script) => script.path);
  expect(solidPaths).toContain(solid.demoUrl);
  expect(solidPaths).not.toContain(react.demoUrl);
  expect(solid.scripts.some((script) => solidRuntime.test(script.body))).toBe(true);

  await reactPage.close();
  await solidPage.close();
});
