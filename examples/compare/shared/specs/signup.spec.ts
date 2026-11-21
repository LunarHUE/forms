import { expect, test } from "./fixtures.ts";

// The field's wrapper, found by its label, so errors are read per field.
const fieldOf = (page: import("@playwright/test").Page, label: string) =>
  page.locator(".field").filter({ has: page.getByLabel(label, { exact: true }) });

test("errors wait for the blur, then follow every input", async ({ open }) => {
  const page = await open("signup");
  const email = page.getByLabel("Email");
  await email.fill("ada");
  await expect(fieldOf(page, "Email").locator(".errors")).toBeEmpty();
  await email.blur();
  await expect(fieldOf(page, "Email")).toContainText("Enter a valid email.");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await email.fill("ada@example.com");
  await expect(fieldOf(page, "Email").locator(".errors")).toBeEmpty();
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
});

test("confirm checks against the password, both ways", async ({ open }) => {
  const page = await open("signup");
  await page.getByLabel("Password", { exact: true }).fill("correct horse");
  const confirm = page.getByLabel("Confirm password");
  await confirm.fill("correct hors");
  await confirm.blur();
  await expect(fieldOf(page, "Confirm password")).toContainText("The passwords don't match.");
  await confirm.fill("correct horse");
  await expect(fieldOf(page, "Confirm password").locator(".errors")).toBeEmpty();
  // Changing the password re-checks the confirmation.
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
  await expect(fieldOf(page, "Confirm password")).toContainText("The passwords don't match.");
});

test("the username check runs on the server after a pause", async ({ open }) => {
  const page = await open("signup");
  const username = page.getByLabel("Username");
  await username.fill("ad");
  await username.blur();
  await expect(fieldOf(page, "Username")).toContainText("Use at least 3 characters.");
  await username.fill("ada");
  await expect(fieldOf(page, "Username")).toContainText("Checking...");
  await expect(fieldOf(page, "Username")).toContainText("That username is taken.");
  await username.fill("ada_l");
  await expect(fieldOf(page, "Username").locator(".errors")).toBeEmpty();
  await expect(fieldOf(page, "Username")).not.toContainText("Checking...");
});

/** Marks the field with `data-saw-checking` if it shows "Checking..." at any point from now on. */
async function watchChecking(page: import("@playwright/test").Page, label: string) {
  await fieldOf(page, label).evaluate((element) => {
    if (!(element instanceof HTMLElement)) return;
    new MutationObserver(() => {
      if (element.textContent.includes("Checking...")) element.dataset["sawChecking"] = "";
    }).observe(element, { subtree: true, childList: true, characterData: true });
  });
}

test("the username's format rules answer at once, without a server check", async ({ open }) => {
  const page = await open("signup");
  const username = page.getByLabel("Username");
  const field = fieldOf(page, "Username");
  await watchChecking(page, "Username");
  await username.fill("ad");
  await username.blur();
  await expect(field).toContainText("Use at least 3 characters.");
  await username.fill("ad-a");
  await expect(field).toContainText("Use letters, digits and underscores.");
  await username.fill("a");
  await expect(field).toContainText("Use at least 3 characters.");
  await expect(field).not.toHaveAttribute("data-saw-checking");
  // A well-formed name is the only kind that waits for the server.
  await username.fill("ada");
  await expect(field).toHaveAttribute("data-saw-checking");
  await expect(field).toContainText("That username is taken.");
});

test("submitting an empty form shows every error", async ({ open }) => {
  const page = await open("signup");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(fieldOf(page, "Email")).toContainText("Enter a valid email.");
  await expect(fieldOf(page, "Username")).toContainText("Use at least 3 characters.");
  await expect(fieldOf(page, "Password")).toContainText("Use at least 8 characters.");
  await expect(fieldOf(page, "Confirm password")).toContainText("Confirm your password.");
  await expect(page.getByText("Accept the terms to continue.")).toBeVisible();
  await expect(page.getByRole("status")).toBeEmpty();
});

async function fillValid(page: import("@playwright/test").Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Username").fill("lovelace");
  await page.getByLabel("Password", { exact: true }).fill("correct horse");
  await page.getByLabel("Confirm password").fill("correct horse");
  await page.getByLabel("I accept the terms").check();
}

test("the server's refusal lands on the email field and clears on edit", async ({ open }) => {
  const page = await open("signup");
  await fillValid(page, "taken@example.com");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(fieldOf(page, "Email")).toContainText("That email already has an account.");
  await expect(page.getByRole("status")).toBeEmpty();
  await page.getByLabel("Email").fill("ada.lovelace@example.com");
  await expect(fieldOf(page, "Email").locator(".errors")).toBeEmpty();
});

test("a valid form signs up", async ({ open }) => {
  const page = await open("signup");
  await fillValid(page, "ada.lovelace@example.com");
  const submit = page.getByRole("button", { name: "Create account" });
  await submit.click();
  await expect(page.getByRole("button", { name: "Creating account..." })).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Welcome, lovelace.");
});
