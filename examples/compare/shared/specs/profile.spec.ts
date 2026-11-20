import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures.ts";

const fieldOf = (page: Page, label: string) => page.locator(".field").filter({ has: page.getByLabel(label, { exact: true }) });

async function openProfile(open: (app: "profile") => Promise<Page>) {
  const page = await open("profile");
  await expect(page.getByLabel("Name")).toHaveValue("Ada Lovelace");
  return page;
}

test("a changed field is marked, and typing the original back clears it", async ({ open }) => {
  const page = await openProfile(open);
  const save = page.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();
  await expect(page.getByText("No unsaved changes")).toBeVisible();

  await page.getByLabel("Name").fill("Ada");
  await expect(fieldOf(page, "Name")).toHaveAttribute("data-changed", "");
  await expect(page.getByText("1 unsaved change")).toBeVisible();
  await expect(save).toBeEnabled();

  await page.getByLabel("Name").fill("Ada Lovelace");
  await expect(fieldOf(page, "Name")).not.toHaveAttribute("data-changed");
  await expect(save).toBeDisabled();
});

test("nested fields count as their own changes", async ({ open }) => {
  const page = await openProfile(open);
  await page.getByLabel("Product news").uncheck();
  await page.getByLabel("Digest").selectOption("daily");
  await expect(page.getByText("2 unsaved changes")).toBeVisible();
  await expect(fieldOf(page, "Digest")).toHaveAttribute("data-changed", "");
  await page.getByLabel("Product news").check();
  await page.getByLabel("Digest").selectOption("weekly");
  await expect(page.getByText("No unsaved changes")).toBeVisible();
});

test("the schema's errors show after a blur and block the save", async ({ open }) => {
  const page = await openProfile(open);
  await page.getByLabel("Email").fill("ada");
  await page.getByLabel("Email").blur();
  await expect(fieldOf(page, "Email")).toContainText("Enter a valid email.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toBeEmpty();
  await page.getByLabel("Email").fill("ada@lovelace.dev");
  await expect(fieldOf(page, "Email").locator(".errors")).toBeEmpty();
});

test("a save makes the form clean, except for edits made while it ran", async ({ open }) => {
  const page = await openProfile(open);
  await page.getByLabel("Name").fill("Ada King");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Saving..." })).toBeDisabled();
  // Typed while the save is in flight.
  await page.getByLabel("Bio").fill("Wrote the first program.");
  await expect(page.getByRole("status")).toHaveText("Saved.");

  await expect(fieldOf(page, "Name")).not.toHaveAttribute("data-changed");
  await expect(page.getByLabel("Name")).toHaveValue("Ada King");
  await expect(fieldOf(page, "Bio")).toHaveAttribute("data-changed", "");
  await expect(page.getByLabel("Bio")).toHaveValue("Wrote the first program.");
  await expect(page.getByText("1 unsaved change")).toBeVisible();
});

test("refresh takes the server's copy where the user changed nothing", async ({ open }) => {
  const page = await openProfile(open);
  await page.getByLabel("Name").fill("Augusta Ada");
  await page.getByRole("button", { name: "Edit on the server" }).click();
  await page.getByRole("button", { name: "Refresh" }).click();

  // The server changed the name and the bio. The name keeps the user's text.
  await expect(page.getByLabel("Bio")).toHaveValue("Countess of Lovelace.");
  await expect(fieldOf(page, "Bio")).not.toHaveAttribute("data-changed");
  await expect(page.getByLabel("Name")).toHaveValue("Augusta Ada");
  await expect(fieldOf(page, "Name")).toHaveAttribute("data-changed", "");
  await expect(page.getByText("1 unsaved change")).toBeVisible();

  // Discard now goes back to the server's copy.
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Ada King");
  await expect(page.getByText("No unsaved changes")).toBeVisible();
});

test("discard goes back to the loaded profile", async ({ open }) => {
  const page = await openProfile(open);
  await page.getByLabel("Name").fill("Someone else");
  await page.getByLabel("Time zone").selectOption("Asia/Tokyo");
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByLabel("Time zone")).toHaveValue("Europe/London");
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
});
