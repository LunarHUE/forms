import { expect, type Locator, type Page, test } from "@playwright/test";

/** The number a render badge shows. */
async function badge(page: Page, name: string): Promise<number> {
  return Number(await page.locator(`[data-badge="${name}"]`).textContent());
}

/** The inspector's table cell for a field and column. */
function cell(page: Page, path: readonly string[], column: string): Locator {
  return page.locator(`.inspector-table tr[data-path='${JSON.stringify(path)}'] td[data-column="${column}"]`);
}

/** The inspector's rows for the line items and everything below them. */
function lineItemRows(page: Page): Locator {
  return page.locator(`.inspector-table tr[data-path^='["lineItems",']`);
}

/** Opens the page and waits until the inspector, which mounts after hydration, shows the fields. */
async function open(page: Page): Promise<void> {
  await page.goto("/");
  await expect(cell(page, ["customer", "name"], "value")).toBeVisible();
}

test("the server HTML already has the order's values", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('value="Ada Lovelace"');
  expect(html).toContain('value="ada@example.com"');
  expect(html).toContain('value="Analytical engine manual"');
  expect(html).toContain("Rendered on the server at");
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

test("typing in the name moves only the name's badge", async ({ page }) => {
  await open(page);
  const before = {
    name: await badge(page, "customer.name"),
    email: await badge(page, "customer.email"),
    page: await badge(page, "OrderPage"),
    summary: await badge(page, "OrderSummary"),
  };
  console.log("badges after load", before);
  expect(before).toEqual({ name: 1, email: 1, page: 1, summary: 1 });

  const name = page.getByRole("textbox", { name: "Name" });
  await name.click();
  await name.press("End");
  await name.pressSequentially(" Byron");
  await expect(cell(page, ["customer", "name"], "value")).toHaveText('"Ada Lovelace Byron"');
  const after = {
    name: await badge(page, "customer.name"),
    email: await badge(page, "customer.email"),
    page: await badge(page, "OrderPage"),
    summary: await badge(page, "OrderSummary"),
  };
  console.log("badges after typing", after);
  expect(after.name).toBeGreaterThan(before.name);
  expect(after.email).toBe(before.email);
  expect(after.page).toBe(before.page);
  expect(after.summary).toBe(before.summary);
});

test("editing a quantity moves the field and the totals, not the row", async ({ page }) => {
  await open(page);
  const all = await page.locator("[data-badge]").evaluateAll((elements) =>
    elements.map((element) => `${element.getAttribute("data-badge")}=${element.textContent}`),
  );
  console.log("all badges after load", all.join(" "));
  const row = page.locator(".line-items tbody tr").first().locator("[data-badge]").last();
  const rowBefore = Number(await row.textContent());
  const summaryBefore = await badge(page, "OrderSummary");
  const quantityBefore = await badge(page, "lineItems.0.quantity");
  const quantity = page.getByRole("spinbutton", { name: "Item 1 quantity" });
  await quantity.fill("2");
  await expect(page.getByTestId("amount-due")).toHaveText("101.50");
  expect(Number(await row.textContent())).toBe(rowBefore);
  expect(await badge(page, "OrderSummary")).toBeGreaterThan(summaryBefore);
  expect(await badge(page, "lineItems.0.quantity")).toBeGreaterThan(quantityBefore);
});

test("blurring a field shows it touched in the inspector", async ({ page }) => {
  await open(page);
  const touched = cell(page, ["customer", "name"], "touched");
  await expect(touched).toHaveText("false");
  await page.getByRole("textbox", { name: "Name" }).focus();
  await page.getByRole("textbox", { name: "Name" }).blur();
  await expect(touched).toHaveText("true");
});

test("adding and removing a line item adds and removes inspector rows", async ({ page }) => {
  await open(page);
  const rows = lineItemRows(page);
  // Two items, each a row for the item and one per property.
  await expect(rows).toHaveCount(8);
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(rows).toHaveCount(12);
  await expect(page.getByLabel("Item 3 description")).toBeVisible();
  await page.getByRole("button", { name: "Remove item 3" }).click();
  await expect(rows).toHaveCount(8);
  await expect(page.getByLabel("Item 3 description")).toHaveCount(0);
});

test("ticking same as billing disables the shipping inputs", async ({ page }) => {
  await open(page);
  const shipping = page.getByRole("group", { name: "Shipping address" });
  const same = page.getByLabel("Ship to the billing address");
  // The loaded order ships to the billing address, so shipping starts disabled.
  await expect(same).toBeChecked();
  await expect(shipping.getByLabel("Street")).toBeDisabled();
  await same.uncheck();
  await expect(shipping.getByLabel("Street")).toBeEnabled();
  await expect(shipping.getByLabel("Country")).toBeEnabled();
  await same.check();
  for (const label of ["Street", "City", "Postcode", "Country"]) {
    await expect(shipping.getByLabel(label)).toBeDisabled();
  }
  await expect(cell(page, ["shipping"], "disabled")).toHaveText("true");
});

test("a submit saves, and a refused save puts the server's error on the email", async ({ page }) => {
  await open(page);
  const status = page.locator(".form-status");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(status).toHaveText(/^Saved as ORD-\d+\.$/);

  await page.getByLabel("Server rejects next save").check();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(status).toHaveText("The server refused the order.");
  const email = page.getByRole("textbox", { name: "Email" });
  await expect(email).toHaveAttribute("aria-invalid", "true");
  const describedBy = await email.getAttribute("aria-describedby");
  expect(describedBy).not.toBeNull();
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText("This customer's account is on hold.");
  await expect(page.getByRole("list", { name: "Form errors" })).toHaveText("The server refused the order. Try again.");
  // The reject toggle turns itself off, so the next save goes through.
  await expect(page.getByLabel("Server rejects next save")).not.toBeChecked();
});

test("an error appearing doesn't move the submit button", async ({ page }) => {
  await open(page);
  const button = page.getByRole("button", { name: "Place order" });
  const name = page.getByRole("textbox", { name: "Name" });
  await name.fill("");
  // Measure after filling, which can scroll the field into view. The error
  // appears on blur.
  const before = await button.boundingBox();
  await name.blur();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  const after = await button.boundingBox();
  console.log("submit button before and after the error", before, after);
  expect(after).toEqual(before);
});
