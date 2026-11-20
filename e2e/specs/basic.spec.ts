import { basicScenario as scenario } from "../contract/index.js";
import { describedBy, expect, input, open, probe, test } from "./fixtures.js";

const { labels, errors, submit } = scenario;

test.beforeEach(async ({ page }) => {
  await open(page, "basic");
});

test("typing writes the value, and blur marks the field touched", async ({ page }) => {
  const name = input(page, labels.name);
  await name.fill("Grace Hopper");
  await expect.poll(async () => (await probe(page)).value).toMatchObject({ name: "Grace Hopper" });
  expect((await probe(page)).fields["name"]?.touched).toBe(false);
  await name.blur();
  await expect.poll(async () => (await probe(page)).fields["name"]?.touched).toBe(true);
});

test("an error shows on blur and clears when the value is fixed", async ({ page }) => {
  const name = input(page, labels.name);
  await name.fill("");
  await expect(name).not.toHaveAttribute("aria-invalid", "true");
  await name.blur();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(await describedBy(page, name)).toHaveText(errors.name);
  expect((await probe(page)).fields["name"]?.shown).toEqual([errors.name]);
  await name.fill("G");
  await expect(name).not.toHaveAttribute("aria-invalid", "true");
  await expect(name).not.toHaveAttribute("aria-describedby");
  await expect.poll(async () => (await probe(page)).fields["name"]?.errors).toEqual([]);
});

test("an invalid submit focuses the first invalid field and points it at its error", async ({ page }) => {
  const email = input(page, labels.email);
  await email.fill("not an email");
  await page.getByRole("button", { name: submit.idle }).click();
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(await describedBy(page, email)).toHaveText(errors.email);
  await expect(input(page, labels.name)).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("status")).toHaveText("");
  await expect.poll(async () => (await probe(page)).form.submission.status).toBe("invalid");
});

test("with two invalid fields, the first in the form takes focus", async ({ page }) => {
  const name = input(page, labels.name);
  const email = input(page, labels.email);
  await email.fill("not an email");
  await name.fill("");
  await page.getByRole("button", { name: submit.idle }).click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(await describedBy(page, name)).toHaveText(errors.name);
});

test("a submit shows the busy button, then the result", async ({ page }) => {
  await input(page, labels.name).fill("Grace Hopper");
  await input(page, labels.newsletter).check();
  await page.getByRole("button", { name: submit.idle }).click();
  const busy = page.getByRole("button", { name: submit.busy });
  await expect(busy).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Signed up Grace Hopper (save 1).");
  await expect(page.getByRole("button", { name: submit.idle })).toBeEnabled();
  const state = await probe(page);
  expect(state.form.submission).toEqual({ status: "succeeded", result: "Signed up Grace Hopper (save 1)." });
  expect(state.value).toEqual({ name: "Grace Hopper", email: "ada@example.com", newsletter: true });
});

test("optional fields start empty and unticked, and take what the user enters", async ({ page }) => {
  const nickname = input(page, labels.nickname);
  const updates = input(page, labels.updates);
  await expect(nickname).toHaveValue("");
  await expect(updates).not.toBeChecked();
  expect((await probe(page)).value).toEqual({ name: "Ada Lovelace", email: "ada@example.com", newsletter: false });
  await nickname.fill("Ada");
  await updates.check();
  await expect.poll(async () => (await probe(page)).value).toMatchObject({ nickname: "Ada", updates: true });
  await nickname.fill("");
  await updates.uncheck();
  await expect.poll(async () => (await probe(page)).value).toMatchObject({ nickname: "", updates: false });
  await page.getByRole("button", { name: submit.idle }).click();
  await expect(page.getByRole("status")).toHaveText("Signed up Ada Lovelace (save 1).");
});

test("a second submit while one runs doesn't save twice", async ({ page }) => {
  // Two submits in one task, before the button can turn disabled.
  await page.locator("form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByRole("status")).toHaveText("Signed up Ada Lovelace (save 1).");
  await page.getByRole("button", { name: submit.idle }).click();
  await expect(page.getByRole("status")).toHaveText("Signed up Ada Lovelace (save 2).");
  const state = await probe(page);
  expect(state.sources["server"]).toHaveLength(2);
  expect(state.form.submitCount).toBe(2);
});

test("an error appearing doesn't move the submit button", async ({ page }) => {
  const name = input(page, labels.name);
  await name.fill("");
  const button = page.getByRole("button", { name: submit.idle });
  const before = await button.boundingBox();
  await name.blur();
  await expect(await describedBy(page, name)).toHaveText(errors.name);
  expect(await button.boundingBox()).toEqual(before);
});
