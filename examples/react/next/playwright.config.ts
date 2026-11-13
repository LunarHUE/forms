import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const production = process.env["E2E_PRODUCTION"] === "1";
const baseURL = process.env["E2E_BASE_URL"];

/**
 * Smoke tests against `next dev`. Development mode is the stricter check
 * here: React reports hydration mismatches in full there, and StrictMode
 * mounts every component twice, which the render badges must account for.
 * `E2E_PRODUCTION=1` runs the same tests against `next build` and `next start`.
 * `E2E_BASE_URL=http://localhost:3000` runs them against a server that is
 * already running, since Next.js allows one `next dev` per app directory.
 */
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: baseURL ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // No server of its own when the tests point at one that is already running.
  webServer:
    baseURL === undefined
      ? {
          command: production ? `bun run build && bun run start --port ${port}` : `bun run dev --port ${port}`,
          url: `http://localhost:${port}`,
          reuseExistingServer: false,
          timeout: 180_000,
        }
      : [],
});
