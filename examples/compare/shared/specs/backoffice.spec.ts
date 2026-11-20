import { expect, test } from "./fixtures.ts";

test.describe("back office", () => {
  test.beforeEach(async ({ open }) => {
    const page = await open("backoffice");
    await expect(page.getByRole("button", { name: "Save" })).toHaveCount(3);
  });

  test("shows shipping only when it differs, and the state only for US addresses", async ({ page }) => {
    const customer = page.getByRole("region", { name: "Customer" });
    const billing = customer.getByRole("group", { name: "Billing address" });
    await expect(customer.getByRole("group", { name: "Shipping address" })).toHaveCount(0);
    await expect(billing.getByLabel("State")).toHaveValue("VA");

    await billing.getByLabel("Country").selectOption("GB");
    await expect(billing.getByLabel("State")).toHaveCount(0);

    await customer.getByLabel("Ship to the billing address").uncheck();
    const shipping = customer.getByRole("group", { name: "Shipping address" });
    await expect(shipping.getByLabel("Street")).toBeVisible();
    await expect(shipping.getByLabel("State")).toBeVisible();
    await expect(customer.getByText("2 unsaved changes")).toBeVisible();
  });

  test("lists every error in a summary once a save is tried", async ({ page }) => {
    const customer = page.getByRole("region", { name: "Customer" });
    await customer.getByLabel("Name").fill("");
    await customer.getByLabel("Ship to the billing address").uncheck();
    await customer.getByRole("button", { name: "Save" }).click();

    const summary = customer.getByRole("alert");
    await expect(summary).toContainText("Fix 4 fields before saving:");
    await expect(summary.getByRole("link", { name: "name", exact: true })).toBeVisible();
    await expect(summary.getByRole("link", { name: "shipping.street" })).toBeVisible();
    await expect(summary.getByRole("link", { name: "shipping.city" })).toBeVisible();
    await expect(summary.getByRole("link", { name: "shipping.postcode" })).toBeVisible();

    await customer.getByLabel("Ship to the billing address").check();
    await customer.getByLabel("Name").fill("Grace Brewster Hopper");
    await expect(summary).toHaveCount(0);
  });

  test("masks phone, tax ID, quantity and price as the user types", async ({ page }) => {
    const company = page.getByRole("region", { name: "Company settings" });
    await company.getByLabel("Phone").fill("");
    await company.getByLabel("Phone").pressSequentially("20a7555x0100");
    await expect(company.getByLabel("Phone")).toHaveValue("(207) 555-0100");
    await company.getByLabel("Tax ID").fill("98-7654321");
    await expect(company.getByLabel("Tax ID")).toHaveValue("98-7654321");

    const order = page.getByRole("region", { name: "Order" });
    await expect(order.getByText("Total: $1,299.00")).toBeVisible();
    await order.getByRole("button", { name: "Add line" }).click();
    await order.getByLabel("SKU 3").fill("TAPE");
    await order.getByLabel("Quantity 3").fill("3 boxes");
    await expect(order.getByLabel("Quantity 3")).toHaveValue("3");
    await order.getByLabel("Price 3").fill("$1234.567");
    await expect(order.getByLabel("Price 3")).toHaveValue("1,234.56");
    await expect(order.getByText("Total: $5,002.68")).toBeVisible();

    await order.getByRole("button", { name: "Remove line 1" }).click();
    await expect(order.getByLabel("SKU 1")).toHaveValue("UNIVAC-PUNCH");
    await expect(order.getByText("Total: $4,903.68")).toBeVisible();
  });

  test("shows the gift message by rule, and undoes edits one at a time", async ({ page }) => {
    const order = page.getByRole("region", { name: "Order" });
    const undo = order.getByRole("button", { name: "Undo" });
    await expect(order.getByLabel("Gift message")).toHaveCount(0);
    await expect(undo).toBeDisabled();

    await order.getByLabel("This order is a gift").check();
    await order.getByLabel("Gift message").fill("Happy birthday");
    await order.getByLabel("Reference").fill("PO-2000");
    await expect(order.getByText("3 unsaved changes")).toBeVisible();

    await undo.click();
    await expect(order.getByLabel("Reference")).toHaveValue("PO-1001");
    await undo.click();
    await expect(order.getByLabel("Gift message")).toHaveValue("");
    await undo.click();
    await expect(order.getByLabel("Gift message")).toHaveCount(0);
    await expect(order.getByText("No unsaved changes")).toBeVisible();
    await expect(undo).toBeDisabled();
  });

  test("is clean after a save, except for edits made while it ran", async ({ page }) => {
    const company = page.getByRole("region", { name: "Company settings" });
    const save = company.getByRole("button", { name: "Save" });
    await expect(save).toBeDisabled();

    await company.getByLabel("Company name").fill("Analytical Engines Group");
    await company.getByRole("group", { name: "Registered address" }).getByLabel("City").fill("Cambridge");
    await expect(company.getByText("2 unsaved changes")).toBeVisible();
    await save.click();
    await expect(company.getByRole("button", { name: "Saving..." })).toBeVisible();
    await company.getByLabel("Phone").fill("2075550111");
    await expect(company.getByRole("status")).toHaveText("Company saved.");
    await expect(company.getByText("1 unsaved change")).toBeVisible();

    await company.getByRole("button", { name: "Discard" }).click();
    await expect(company.getByLabel("Company name")).toHaveValue("Analytical Engines Group");
    await expect(company.getByLabel("Phone")).toHaveValue("(207) 555-0198");
  });

  test("shows the server's refusal on the field until the user edits it", async ({ page }) => {
    const company = page.getByRole("region", { name: "Company settings" });
    const taxId = company.getByLabel("Tax ID");
    await taxId.fill("000000000");
    await company.getByRole("button", { name: "Save" }).click();
    await expect(company.locator(".field").getByText("No company has this tax ID.")).toBeVisible();
    await expect(taxId).toHaveAttribute("aria-invalid", "true");
    await expect(company.getByRole("status")).toHaveText("");

    await taxId.fill("123456780");
    await expect(company.getByText("No company has this tax ID.")).toHaveCount(0);
  });

  test("leaves a refused save unsaved", async ({ page, library }) => {
    // Ours marks the refused values clean until #224 is fixed:
    // https://github.com/LunarHUE/forms/issues/224
    test.fail(library === "lunarhue", "baselineOnSubmit() takes a refused save as the baseline (#224).");
    const company = page.getByRole("region", { name: "Company settings" });
    await company.getByLabel("Tax ID").fill("000000000");
    await company.getByRole("button", { name: "Save" }).click();
    await expect(company.locator(".field").getByText("No company has this tax ID.")).toBeVisible();
    await expect(company.getByText("1 unsaved change")).toBeVisible();
    await expect(company.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  test("takes the server's copy on refresh for fields the user left alone", async ({ page }) => {
    const company = page.getByRole("region", { name: "Company settings" });
    await company.getByLabel("Phone").fill("2075550111");
    await page.getByRole("button", { name: "Edit company" }).click();
    await company.getByRole("button", { name: "Refresh" }).click();

    await expect(company.getByLabel("Company name")).toHaveValue("Analytical Engines plc");
    await expect(company.getByLabel("Phone")).toHaveValue("(207) 555-0111");
    await expect(company.getByText("1 unsaved change")).toBeVisible();

    await company.getByRole("button", { name: "Discard" }).click();
    await expect(company.getByLabel("Phone")).toHaveValue("(207) 555-0100");
  });

  test("keeps the invite draft across a reload, and clears it once sent", async ({ page }) => {
    await page.getByRole("button", { name: "Invite a teammate" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite a teammate" });
    await dialog.getByLabel("Email").fill("ada@example.com");
    await dialog.getByLabel("Role").selectOption("admin");
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();

    // The draft is saved once the page is idle.
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).length)).toBeGreaterThan(0);
    await page.reload();
    await page.getByRole("button", { name: "Invite a teammate" }).click();
    await expect(dialog.getByLabel("Email")).toHaveValue("ada@example.com");
    await expect(dialog.getByLabel("Role")).toHaveValue("admin");

    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Invitation sent to ada@example.com.");
    await expect(dialog.getByLabel("Email")).toHaveValue("");
    await expect(dialog.getByLabel("Role")).toHaveValue("member");
  });
});
