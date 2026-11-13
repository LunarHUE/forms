import { expect, type Locator, type Page, test } from "@playwright/test";

/** Opens the bind page and waits until the inspector, which mounts after hydration, is there. */
async function open(page: Page): Promise<void> {
  await page.goto("/bind");
  await expect(page.locator(".inspector")).toBeVisible();
}

/** A text input of the profile form, by its label. */
function input(page: Page, label: string): Locator {
  return page.getByRole("form", { name: "Profile" }).getByRole("textbox", { name: label, exact: true });
}

/** The store's state as the panel shows it. */
async function store(page: Page): Promise<unknown> {
  return JSON.parse((await page.getByTestId("store").textContent()) ?? "null");
}

test("the server HTML starts the form from the store", async ({ request }) => {
  const response = await request.get("/bind");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('value="Ada Lovelace"');
  expect(html).toContain('value="ada@example.com"');
  expect(html).toContain('value="12 St James&#x27;s Square"');
});

test("loads and hydrates with no console errors or warnings", async ({ page }) => {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") messages.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
  await open(page);
  // Give late effects and hydration warnings time to arrive.
  await page.waitForTimeout(1000);
  expect(messages).toEqual([]);
});

test("typing in the form updates the store", async ({ page }) => {
  await open(page);
  await input(page, "Name").fill("Ada Byron");
  await input(page, "City").fill("Ockham");
  await expect(page.getByTestId("store")).toContainText('"name": "Ada Byron"');
  expect(await store(page)).toEqual({
    name: "Ada Byron",
    email: "ada@example.com",
    address: { street: "12 St James's Square", city: "Ockham" },
  });
});

test("a change to the store shows up in the form", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Change the store" }).click();
  await expect(input(page, "Name")).toHaveValue("Grace Hopper");
  await expect(input(page, "Email")).toHaveValue("grace@example.com");
  await expect(input(page, "Street")).toHaveValue("12 St James's Square");
});

test("refresh keeps an edited field and takes the fresh values for the rest", async ({ page }) => {
  await open(page);
  await input(page, "Name").fill("Ada Byron");
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(input(page, "Email")).toHaveValue("ada.king@example.com");
  await expect(input(page, "Name")).toHaveValue("Ada Byron");
  await expect(input(page, "Street")).toHaveValue("Horsley Towers");
  await expect(input(page, "City")).toHaveValue("East Horsley");
  // The rebase is a form write, so the binding copies the result to the store.
  await expect(page.getByTestId("store")).toContainText('"email": "ada.king@example.com"');
  expect(await store(page)).toEqual({
    name: "Ada Byron",
    email: "ada.king@example.com",
    address: { street: "Horsley Towers", city: "East Horsley" },
  });
});

test("a submit saves the form", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved Ada Lovelace.");
});
