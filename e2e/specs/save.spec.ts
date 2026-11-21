import { saveScenario as scenario } from "../contract/index.js";
import { describedBy, expect, input, open, probe, test } from "./fixtures.js";

const { labels, messages, submit } = scenario;

test.beforeEach(async ({ page }) => {
  await open(page, "save");
});

test("a submit saves", async ({ page }) => {
  await page.getByRole("button", { name: submit.idle }).click();
  await expect(page.getByRole("status")).toHaveText("Saved Ada Lovelace (save 1).");
});

test("a refused save puts the server's errors on the field and the form, focuses the form, and the next save works", async ({ page }) => {
  const email = input(page, labels.email);
  const formErrors = page.getByRole("list", { name: labels.formErrors });
  await email.fill(scenario.takenEmail);
  await page.getByRole("button", { name: submit.idle }).click();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  // The form's own error comes first, so focus goes to the form element.
  await expect(page.locator("form")).toBeFocused();
  await expect(page.getByRole("status")).toHaveText("");
  await expect(await describedBy(page, email)).toHaveText(messages.email);
  await expect(formErrors).toHaveText(messages.form);
  const refused = await probe(page);
  expect(refused.fields["email"]?.shown).toEqual([messages.email]);
  expect(refused.fields[""]?.shown).toEqual([messages.form]);

  // Editing the field clears its server error.
  await email.fill("ada@example.com");
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: submit.idle }).click();
  await expect(page.getByRole("status")).toHaveText("Saved Ada Lovelace (save 2).");
  await expect(formErrors).toHaveText("");
  await expect.poll(async () => (await probe(page)).fields[""]?.errors).toEqual([]);
});

test("a server error under a name the form doesn't have shows with the form's errors", async ({ page }) => {
  const formErrors = page.getByRole("list", { name: labels.formErrors });
  await input(page, labels.name).fill(scenario.renamedName);
  await page.getByRole("button", { name: submit.idle }).click();
  await expect(formErrors).toHaveText(messages.renamed);
  await expect(page.getByRole("status")).toHaveText("");
  const refused = await probe(page);
  expect(refused.fields[""]?.shown).toEqual([messages.renamed]);
});

test("an error summary lists the server's errors, focuses a field from its entry, and drops the field once it is fixed", async ({ page }) => {
  const email = input(page, labels.email);
  const summary = page.getByRole("list", { name: labels.summary });
  await expect(summary.getByRole("listitem")).toHaveCount(0);
  await email.fill(scenario.takenEmail);
  await page.getByRole("button", { name: submit.idle }).click();
  await expect(summary.getByRole("listitem")).toHaveText([`form: ${messages.form}`, `email: ${messages.email}`]);

  await summary.getByRole("button", { name: `email: ${messages.email}` }).click();
  await expect(email).toBeFocused();
  await email.fill("ada@example.com");
  await expect(summary.getByRole("listitem")).toHaveText([`form: ${messages.form}`]);
});
