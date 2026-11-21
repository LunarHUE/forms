import { expect, test } from "./fixtures.ts";

test("shows errors on empty submit and clears them as fields are fixed", async ({ open }) => {
  const page = await open("login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter a valid email.")).toBeVisible();
  await expect(page.getByText("Use at least 8 characters.")).toBeVisible();

  await page.getByLabel("Email").fill("ada@example.com");
  await expect(page.getByText("Enter a valid email.")).toBeHidden();

  await page.getByLabel("Password").fill("hunter22");
  await expect(page.getByText("Use at least 8 characters.")).toBeHidden();
});

test("shows server refusals on the field and signs in once valid", async ({ open }) => {
  const page = await open("login");
  await page.getByLabel("Email").fill("locked@example.com");
  await page.getByLabel("Password").fill("hunter22");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("This account is locked.")).toBeVisible();

  await page.getByLabel("Email").fill("ada@example.com");
  await expect(page.getByText("This account is locked.")).toBeHidden();

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("status")).toHaveText("Signed in as ada@example.com.");
});
