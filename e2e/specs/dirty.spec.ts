import { dirtyScenario as scenario } from "../contract/index.js";
import { describedBy, expect, input, open, probe, test } from "./fixtures.js";

const { labels, errors, submit } = scenario;

test.beforeEach(async ({ page }) => {
  await open(page, "dirty");
});

test("save is enabled only while a value differs from the start", async ({ page }) => {
  const save = page.getByRole("button", { name: submit.idle });
  const name = input(page, labels.name);
  await expect(save).toBeDisabled();
  await name.fill("Ada");
  await expect(save).toBeEnabled();
  const changed = await probe(page);
  expect(changed.form.dirty).toBe(true);
  expect(changed.fields["name"]?.dirty).toBe(true);
  expect(changed.fields["email"]?.dirty).toBe(false);
  // Typing the old value back makes the form clean again.
  await name.fill("Ada Lovelace");
  await expect(save).toBeDisabled();
  await expect.poll(async () => (await probe(page)).form.dirty).toBe(false);
});

test("after a successful save the form is clean, and a field edited during the save stays dirty", async ({ page }) => {
  const save = page.getByRole("button", { name: submit.idle });
  const name = input(page, labels.name);
  const email = input(page, labels.email);
  await name.fill("Grace Hopper");
  await email.fill("grace@example.com");
  await save.click();
  // The fake server takes a moment, so this edit lands after the value was sent.
  await email.fill("grace.h@example.com");
  await expect(page.getByRole("status")).toHaveText("Saved Grace Hopper.");
  await expect
    .poll(async () => {
      const { form, fields } = await probe(page);
      return { form: form.dirty, name: fields["name"]?.dirty, email: fields["email"]?.dirty };
    })
    .toEqual({ form: true, name: false, email: true });
  // Typing the saved text back makes the form clean.
  await email.fill("grace@example.com");
  await expect(save).toBeDisabled();
});

test("a save the server refuses leaves the form dirty and focuses the refused field", async ({ page }) => {
  const save = page.getByRole("button", { name: submit.idle });
  const email = input(page, labels.email);
  await email.fill(scenario.takenEmail);
  await save.click();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(await describedBy(page, email)).toHaveText(errors.taken);
  await expect(email).toBeFocused();
  await expect(page.getByRole("status")).toHaveText("");
  await expect(save).toBeEnabled();
  await expect
    .poll(async () => {
      const { form, fields } = await probe(page);
      return { form: form.dirty, email: fields["email"]?.dirty };
    })
    .toEqual({ form: true, email: true });
  // Reset still goes back to the value before the refused save.
  await page.getByRole("button", { name: labels.reset, exact: true }).click();
  await expect(email).toHaveValue("ada@example.com");
});

test("reset puts back the values and clears errors and touched", async ({ page }) => {
  const name = input(page, labels.name);
  const email = input(page, labels.email);
  await name.fill("Grace Hopper");
  await email.fill("nope");
  await email.blur();
  await expect(await describedBy(page, email)).toHaveText(errors.email);
  await page.getByRole("button", { name: labels.reset, exact: true }).click();
  await expect(name).toHaveValue("Ada Lovelace");
  await expect(email).toHaveValue("ada@example.com");
  await expect(email).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("button", { name: submit.idle })).toBeDisabled();
  await expect
    .poll(async () => {
      const { form, fields } = await probe(page);
      return { dirty: form.dirty, email: fields["email"] };
    })
    .toMatchObject({ dirty: false, email: { touched: false, errors: [], dirty: false } });
});

test("resetting one field leaves the others as they are", async ({ page }) => {
  const name = input(page, labels.name);
  const email = input(page, labels.email);
  await name.fill("Grace Hopper");
  await email.fill("grace@example.com");
  await page.getByRole("button", { name: labels.resetEmail }).click();
  await expect(email).toHaveValue("ada@example.com");
  await expect(name).toHaveValue("Grace Hopper");
  await expect(page.getByRole("button", { name: submit.idle })).toBeEnabled();
  await expect
    .poll(async () => {
      const { fields } = await probe(page);
      return { name: fields["name"]?.dirty, email: fields["email"]?.dirty };
    })
    .toEqual({ name: true, email: false });
});
