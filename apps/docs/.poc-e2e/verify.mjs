// Drives the field-pieces POC pages against `astro preview`. Not part of the docs test suite.
import { chromium } from "@playwright/test";

const base = process.env.BASE ?? "http://127.0.0.1:4631";
const shots = new URL("../.poc-shots/", import.meta.url).pathname;
const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ ok, name, actual, expected });
};

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: "light" });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`${page.url()}: ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));

const open = async (slug) => {
  await page.goto(`${base}/poc/${slug}`);
  await page.waitForSelector("astro-island:not([ssr])");
};
const focusedLabel = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute("aria-labelledby")
      ? document.getElementById(el.getAttribute("aria-labelledby").split(" ")[0])?.textContent
      : (el?.labels?.[0]?.textContent ?? el?.closest("label")?.textContent ?? el?.tagName);
  });
const caret = (locator) => locator.evaluate((el) => [el.value, el.selectionStart]);
const setCaret = (locator, at) => locator.evaluate((el, to) => el.setSelectionRange(to, to), at);
const submitted = () => page.getByTestId("submitted").textContent();
const submit = async () => {
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForTimeout(100);
};

// a. Base UI Field + Input with a phone mask.
await open("text-mask");
{
  const phone = page.getByLabel("Phone");
  await page.getByLabel("Name").fill("Ada");
  await submit();
  check("text-mask: invalid submit focuses phone", await focusedLabel(), "Phone");
  check("text-mask: Base UI sets aria-describedby to its error", await phone.evaluate((el) => document.getElementById(el.getAttribute("aria-describedby") ?? "")?.textContent), "Enter a phone number.");
  check("text-mask: id is Base UI's, not ours", await phone.evaluate((el) => el.id.includes("phone")), false);
  await phone.pressSequentially("5551234");
  check("text-mask: typed at end", await caret(phone), ["(555) 123-4", 11]);
  await setCaret(phone, 7);
  await phone.press("9");
  check("text-mask: typed in the middle", await caret(phone), ["(555) 192-34", 8]);
  await setCaret(phone, 9);
  await phone.press("8");
  check("text-mask: typed before the -, caret steps past it", await caret(phone), ["(555) 192-834", 11]);
  await setCaret(phone, 10);
  await phone.press("7");
  check("text-mask: typed right after the -", await caret(phone), ["(555) 192-7834", 11]);
  await setCaret(phone, 10);
  await phone.press("Backspace");
  // Deleting the - deletes no digit, so the text stays and the caret steps back over it.
  check("text-mask: backspace over the -", await caret(phone), ["(555) 192-7834", 9]);
  await phone.press("Backspace");
  check("text-mask: second backspace deletes a digit", await caret(phone), ["(555) 197-834", 8]);
  check("text-mask: stored digits", await page.getByTestId("phone-stored").textContent(), 'stored: "555197834"');
  await submit();
  check("text-mask: submitted", await submitted(), '{"name":"Ada","phone":"555197834"}');
  await page.screenshot({ path: `${shots}text-mask.png`, fullPage: true });
}

// b. NumberField and Field + Input as a number.
await open("number");
{
  await submit();
  check("number: invalid submit focuses quantity", await focusedLabel(), "Quantity (NumberField)");
  const quantity = page.getByLabel("Quantity (NumberField)");
  const price = page.getByLabel("Price (Field + Input)");
  await quantity.pressSequentially("-");
  check("number: NumberField keeps -", await quantity.inputValue(), "-");
  await quantity.fill("");
  await quantity.pressSequentially("12.");
  check("number: NumberField keeps 12.", await quantity.inputValue(), "12.");
  check("number: NumberField stores 12", await page.getByTestId("quantity-stored").textContent(), "stored: 12");
  await price.pressSequentially("-");
  check("number: Input keeps -", await price.inputValue(), "-");
  check("number: - stores nothing", await page.getByTestId("price-stored").textContent(), "stored: undefined");
  await price.pressSequentially("12.");
  check("number: Input keeps -12.", await price.inputValue(), "-12.");
  check("number: -12. stores -12", await page.getByTestId("price-stored").textContent(), "stored: -12");
  await price.pressSequentially("5");
  await page.keyboard.press("Tab");
  check("number: blur shows the number", await price.inputValue(), "-12.5");
  await submit();
  check("number: submitted", await submitted(), '{"quantity":12,"price":-12.5}');
  await page.screenshot({ path: `${shots}number.png`, fullPage: true });
}

// c. Checkbox and CheckboxGroup.
await open("checkbox");
{
  await submit();
  // `terms` comes first in the definition, so it is the first invalid field.
  check("checkbox: invalid submit focuses terms", await page.evaluate(() => document.activeElement?.closest("label")?.textContent), "Accept the terms");
  await page.getByRole("checkbox", { name: "Accept the terms" }).click();
  await submit();
  check("checkbox: then the first topping", await page.evaluate(() => document.activeElement?.closest("label")?.textContent), "cheese");
  await page.getByRole("checkbox", { name: "Accept the terms" }).click();
  await page.getByRole("checkbox", { name: "cheese" }).click();
  await page.getByRole("checkbox", { name: "basil" }).click();
  await page.getByRole("checkbox", { name: "Accept the terms" }).click();
  await submit();
  check("checkbox: submitted", await submitted(), '{"terms":true,"toppings":["cheese","basil"]}');
  await page.getByRole("checkbox", { name: "cheese" }).click();
  await page.getByRole("checkbox", { name: "Accept the terms" }).click();
  await submit();
  check("checkbox: unchecking writes", await submitted(), "invalid");
  await page.getByRole("checkbox", { name: "Accept the terms" }).click();
  await submit();
  check("checkbox: submitted again", await submitted(), '{"terms":true,"toppings":["basil"]}');
  await page.screenshot({ path: `${shots}checkbox.png`, fullPage: true });
}

// d. Select.
await open("select");
{
  await submit();
  check("select: invalid submit focuses the trigger", await page.evaluate(() => document.activeElement?.textContent), "Pick a size▾");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Medium" }).click();
  await submit();
  check("select: submitted", await submitted(), '{"size":"m"}');
  await page.screenshot({ path: `${shots}select.png`, fullPage: true });
}

// e. Plain HTML with inputProps(field).
await open("plain");
{
  await submit();
  check("plain: invalid submit focuses phone", await focusedLabel(), "Phone");
  const phone = page.getByLabel("Phone");
  await phone.pressSequentially("5551234");
  await setCaret(phone, 7);
  await phone.press("9");
  check("plain: typed in the middle", await caret(phone), ["(555) 192-34", 8]);
  const price = page.getByLabel("Price");
  await price.pressSequentially("12.");
  // A type="number" input reports a sanitized `value`, so read what the user sees through a screenshot instead.
  await price.screenshot({ path: `${shots}plain-price.png` });
  await page.getByLabel("olives").check();
  await page.getByLabel("Size").selectOption("l");
  await page.getByLabel("Accept the terms").check();
  await submit();
  check("plain: submitted", await submitted(), '{"phone":"55519234","price":12,"terms":true,"toppings":["olives"],"size":"l"}');
  await page.screenshot({ path: `${shots}plain.png`, fullPage: true });
}

await browser.close();
for (const { ok, name, actual, expected } of results) console.log(ok ? "PASS" : "FAIL", name, ok ? "" : `got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`);
console.log("console errors:", errors.length ? errors : "none");
process.exitCode = results.every((r) => r.ok) && errors.length === 0 ? 0 : 1;
