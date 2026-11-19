import { availableParallelism } from "node:os";

import { defineConfig, devices } from "@playwright/test";

// Smoke tests of the built site: `astro build`, then `astro preview`, in
// Chromium. Run with `bun run test:e2e` from this folder. DOCS_PORT moves the
// preview server off 4560. DOCS_BUILT=1 serves the dist/ already there, which
// CI uses after its own build step.
const port = Number(process.env["DOCS_PORT"] ?? 4560);
const baseURL = `http://127.0.0.1:${port}`;
const preview = `bun run preview --port ${port}`;

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  // Playwright's default counts the host's cores, which in a container can be
  // far more than it may use. This counts the usable ones, as e2e/ does.
  workers: Math.max(1, Math.floor(availableParallelism() / 2)),
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
    command: process.env["DOCS_BUILT"] === "1" ? preview : `bun run build && ${preview}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
