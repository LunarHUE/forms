import type { Page } from "@playwright/test";
import { asyncScenario as scenario, type ServerCall } from "../contract/index.js";
import { describedBy, expect, input, open, probe, test } from "./fixtures.js";

const { labels, errors } = scenario;

test.beforeEach(async ({ page }) => {
  await open(page, "async");
});

/** The fake server's log, as the probe shows it. */
async function calls(page: Page): Promise<readonly ServerCall[]> {
  // The probe's `server` source is the fake server's log.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return ((await probe(page)).sources["server"] ?? []) as readonly ServerCall[];
}

test("a taken name shows the server's error, and a free one clears it", async ({ page }) => {
  const username = input(page, labels.username);
  await username.fill("ada");
  await username.blur();
  await expect(username).toHaveAttribute("aria-invalid", "true");
  await expect(await describedBy(page, username)).toHaveText(errors.taken);
  await username.fill("grace");
  await expect(username).not.toHaveAttribute("aria-invalid", "true");
});

test("the field shows it is checking while the check runs", async ({ page }) => {
  const username = input(page, labels.username);
  const checking = page.getByText(scenario.checking);
  await expect(checking).toBeHidden();
  await username.fill("slowpoke");
  await username.blur();
  await expect(checking).toBeVisible();
  await expect.poll(async () => (await probe(page)).fields["username"]?.validating).toBe(true);
  await expect(checking).toBeHidden({ timeout: 10_000 });
  expect((await probe(page)).fields["username"]?.validating).toBe(false);
});

test("a slow answer for an old value is dropped", async ({ page }) => {
  const username = input(page, labels.username);
  // The server takes long to say "slowtaken" is taken.
  await username.fill("slowtaken");
  await username.blur();
  await expect.poll(async () => (await calls(page)).map((call) => call.input)).toEqual(["slowtaken"]);
  // A newer value is checked and passes before that answer comes back.
  await username.fill("grace");
  await expect.poll(async () => (await probe(page)).fields["username"]?.validating).toBe(false);
  await expect(username).not.toHaveAttribute("aria-invalid", "true");
  // Wait for the stale answer to arrive, then check it changed nothing.
  await expect
    .poll(async () => (await calls(page)).find((call) => call.input === "slowtaken")?.state, { timeout: 10_000 })
    .toBe("done");
  const state = await probe(page);
  expect(state.fields["username"]).toMatchObject({ errors: [], validating: false });
  await expect(username).not.toHaveAttribute("aria-invalid", "true");
});
