import { rulesScenario as scenario } from "../contract/index.js";
import { expect, input, open, probe, test } from "./fixtures.js";

const { labels } = scenario;

test.beforeEach(async ({ page }) => {
  await open(page, "rules");
});

test("the address starts disabled, and unticking pickup enables it", async ({ page }) => {
  const street = input(page, labels.street);
  const city = input(page, labels.city);
  await expect(street).toBeDisabled();
  await expect(city).toBeDisabled();
  expect((await probe(page)).fields["address"]?.disabled).toBe(true);
  await input(page, labels.pickup).uncheck();
  await expect(street).toBeEnabled();
  await expect(city).toBeEnabled();
  await expect.poll(async () => (await probe(page)).fields["address.city"]?.disabled).toBe(false);
  await input(page, labels.pickup).check();
  await expect(street).toBeDisabled();
  await expect(city).toBeDisabled();
});

test("the gift message shows only for a gift", async ({ page }) => {
  const message = input(page, labels.message);
  await expect(message).toHaveCount(0);
  await input(page, labels.gift).check();
  await expect(message).toBeVisible();
  await message.fill("Happy birthday");
  await input(page, labels.gift).uncheck();
  await expect(message).toHaveCount(0);
  await expect.poll(async () => (await probe(page)).value).toMatchObject({ gift: false, message: "Happy birthday" });
});

test("a read-only text field takes no typing", async ({ page }) => {
  const reference = input(page, labels.reference);
  await expect(reference).toHaveAttribute("readonly");
  await reference.focus();
  await page.keyboard.type("X");
  await expect(reference).toHaveValue("ORD-1");
  expect((await probe(page)).value).toMatchObject({ reference: "ORD-1" });
});

test("a read-only checkbox stays as it is when clicked", async ({ page }) => {
  const insured = input(page, labels.insured);
  await expect(insured).toHaveAttribute("aria-readonly", "true");
  await insured.click();
  await expect(insured).toBeChecked();
  expect((await probe(page)).value).toMatchObject({ insured: true });
  expect((await probe(page)).fields["insured"]).toMatchObject({ readOnly: true, edited: false });
});

test("a submit with the address disabled still sends it", async ({ page }) => {
  await page.getByRole("button", { name: scenario.submit.idle }).click();
  await expect(page.getByRole("status")).toHaveText("Ordered for pickup.");
  await input(page, labels.pickup).uncheck();
  await input(page, labels.city).fill("Ockham");
  await page.getByRole("button", { name: scenario.submit.idle }).click();
  await expect(page.getByRole("status")).toHaveText("Ordered to Ockham.");
});
