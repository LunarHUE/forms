import { expect, type Page, test } from "@playwright/test";

/** Opens the basic page and waits until the inspector, which mounts after hydration, is there. */
async function open(page: Page): Promise<void> {
  await page.goto("/basic");
  await expect(page.locator(".inspector")).toBeVisible();
}

test("the server HTML already has the default values", async ({ request }) => {
  const response = await request.get("/basic");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('value="Ada Lovelace"');
  expect(html).toContain('value="ada@example.com"');
  expect(html).toContain('value="36"');
  expect(html).toContain('value="London"');
  expect(html).toContain('value="Charles Babbage"');
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

test("typing and submitting shows the submitting state, then the result", async ({ page }) => {
  await open(page);
  const name = page.getByRole("textbox", { name: "Name", exact: true });
  await name.fill("Grace Hopper");
  await page.getByLabel("Send me the newsletter").check();
  const button = page.getByRole("button", { name: /^Sign(ing)? up/ });
  await button.click();
  await expect(button).toHaveText("Signing up...");
  await expect(button).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Signed up Grace Hopper with a team of 1.");
  await expect(button).toHaveText("Sign up");
  await expect(button).toBeEnabled();
});

test("adding and removing a team member", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Add member" }).click();
  const second = page.getByRole("textbox", { name: "Member 2" });
  await expect(second).toHaveValue("");
  await second.fill("Mary Somerville");
  await page.getByRole("button", { name: "Remove member 1" }).click();
  await expect(page.getByRole("textbox", { name: "Member 2" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Member 1" })).toHaveValue("Mary Somerville");
});

test("an invalid submit shows the error and focuses the first invalid field", async ({ page }) => {
  await open(page);
  const email = page.getByRole("textbox", { name: "Email" });
  await email.fill("");
  const member = page.getByRole("textbox", { name: "Member 1" });
  await member.fill("");
  // The click blurs the member field, which shows its error. The click
  // still lands because the error has space kept for it.
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(member).toHaveAttribute("aria-invalid", "true");
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  const describedBy = await email.getAttribute("aria-describedby");
  expect(describedBy).not.toBeNull();
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText("Enter a valid email.");
  await expect(page.getByRole("status")).toHaveText("");
});

test("an error appearing doesn't move the submit button", async ({ page }) => {
  await open(page);
  const button = page.getByRole("button", { name: "Sign up" });
  const member = page.getByRole("textbox", { name: "Member 1" });
  await member.fill("");
  // Measure after filling, which can scroll the field into view. The error
  // appears on blur.
  const before = await button.boundingBox();
  await member.blur();
  await expect(page.locator(`[id="${await member.getAttribute("aria-describedby")}"]`)).toHaveText("Enter a name.");
  const after = await button.boundingBox();
  console.log("submit button before and after the error", before, after);
  expect(after).toEqual(before);
});
