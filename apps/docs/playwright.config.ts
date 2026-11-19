import { defineConfig, devices } from "@playwright/test";

// Smoke tests of the built site: `astro build`, then `astro preview`, in
// Chromium. Run with `bun run test:e2e` from this folder. DOCS_PORT moves the
// preview server off 4560.
const port = Number(process.env["DOCS_PORT"] ?? 4560);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: process.env["CI"] !== undefined,
  retries: process.env["CI"] === undefined ? 0 : 1,
  reporter: process.env["CI"] === undefined ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    // The theme tests pick Dark themselves; a dark OS would hide the change.
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `bun run build && bun run preview --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
