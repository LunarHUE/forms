import type { Locator, Page } from "@playwright/test";
import { basicScenario, rendersScenario } from "../contract/index.js";
import { expect, input, open, probe, test } from "./fixtures.js";

// How inputs behave and what they carry, the same in every app.

/** An input's attributes, without the generated id and the error link. */
const attributes = (locator: Locator): Promise<Record<string, string>> =>
  locator.evaluate((element) =>
    Object.fromEntries(
      [...element.attributes]
        .filter((attribute) => !["id", "aria-describedby"].includes(attribute.name))
        .map((attribute) => [attribute.name, attribute.value]),
    ),
  );

/** The stored quantity of a line on the renders page. */
async function quantity(page: Page, index: number): Promise<unknown> {
  const { value } = await probe(page);
  // The renders scenario's value is an order.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (value as { lines: { quantity?: number }[] }).lines[index]?.quantity;
}

test.describe("markup", () => {
  const { labels, markup } = basicScenario;

  test.describe(() => {
    test.use({ javaScriptEnabled: false });

    test("a valid text input and checkbox carry the contract's attributes in the server HTML", async ({ page }) => {
      await page.goto(basicScenario.route);
      expect(await attributes(input(page, labels.name))).toEqual(markup.text);
      expect(await attributes(input(page, labels.newsletter))).toEqual(markup.checkbox);
    });
  });

  test("a valid text input and checkbox carry the contract's attributes after hydration", async ({ page }) => {
    await open(page, "basic");
    expect(await attributes(input(page, labels.name))).toEqual(markup.text);
    expect(await attributes(input(page, labels.newsletter))).toEqual(markup.checkbox);
  });
});

test.describe("number inputs", () => {
  const { labels } = rendersScenario;

  test.beforeEach(async ({ page }) => {
    await open(page, "renders");
  });

  test("typed text is kept while typing, and the stored number shows once the input loses focus", async ({ page }) => {
    const field = input(page, labels.quantity(0));
    await field.fill("");
    await field.pressSequentially("2.50");
    await expect(field).toHaveValue("2.50");
    await expect.poll(() => quantity(page, 0)).toBe(2.5);
    await field.blur();
    await expect(field).toHaveValue("2.5");
  });

  test("text that isn't a number yet, such as a lone minus sign, leaves the stored value", async ({ page }) => {
    const field = input(page, labels.quantity(1));
    await field.selectText();
    await field.press("-");
    await expect(field).toHaveValue("");
    await expect.poll(() => quantity(page, 1)).toBe(3);
    await field.press("4");
    await expect.poll(() => quantity(page, 1)).toBe(-4);
  });

  test("an emptied number input stores undefined and shows nothing", async ({ page }) => {
    const field = input(page, labels.quantity(0));
    await field.fill("");
    await expect.poll(() => quantity(page, 0)).toBeUndefined();
    await field.blur();
    await expect(field).toHaveValue("");
  });
});

test("Enter in a text input submits the form", async ({ page }) => {
  await open(page, "basic");
  await input(page, basicScenario.labels.name).press("Enter");
  await expect(page.getByRole("status")).toHaveText("Signed up Ada Lovelace (save 1).");
});
