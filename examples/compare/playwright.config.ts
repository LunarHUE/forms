import { availableParallelism } from "node:os";
import { defineConfig, devices } from "@playwright/test";
import { libraries } from "./apps.ts";
import type { Options } from "./shared/specs/fixtures.ts";

// COMPARE_PORT moves the server when another run holds the default port.
const port = Number(process.env["COMPARE_PORT"] ?? 4890);
const origin = `http://127.0.0.1:${port}`;

// One project per library, all running the same specs against the same app.
export default defineConfig<Options>({
  testDir: "shared/specs",
  fullyParallel: true,
  workers: Math.max(1, Math.floor(availableParallelism() / 2)),
  forbidOnly: process.env["CI"] !== undefined,
  reporter: process.env["CI"] === undefined ? "list" : [["list"], ["html", { open: "never" }]],
  use: { trace: "retain-on-failure" },
  projects: libraries.map((library) => ({
    name: library.name,
    use: { ...devices["Desktop Chrome"], baseURL: origin, library: library.name },
  })),
  webServer: {
    command: `bun run build && bunx vite preview --port ${port}`,
    url: `${origin}/signup/lunarhue/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
