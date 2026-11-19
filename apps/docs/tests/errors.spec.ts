import { readFileSync } from "node:fs";

import { errorAnchors } from "../src/lib/errors";
import { expect, test } from "./fixtures";

const source = readFileSync(new URL("../src/content/errors.mdx", import.meta.url), "utf8");
const anchors = errorAnchors(source);

test("an error link scrolls its entry into view", async ({ page }) => {
  await page.goto("/errors#core:plugins:name");
  const anchor = page.locator('[id="core:plugins:name"]');
  await expect(anchor).toBeAttached();
  // The anchor is empty, so check its position rather than its visibility.
  await expect
    .poll(() =>
      anchor.evaluate((element) => {
        const top = element.getBoundingClientRect().top;
        return top >= 0 && top < window.innerHeight / 2;
      }),
    )
    .toBe(true);
});

test("every anchor in errors.mdx is on the page", async ({ page }) => {
  expect(anchors.length).toBeGreaterThan(0);
  await page.goto("/errors");
  const missing = await page.evaluate(
    (ids) => ids.filter((id) => document.getElementById(id) === null),
    anchors.map((anchor) => anchor.id),
  );
  expect(missing).toEqual([]);
});
