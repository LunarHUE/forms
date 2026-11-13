import { availableParallelism } from "node:os";
import { defineConfig, devices } from "@playwright/test";
import { type Framework, frameworks } from "./contract/index.js";
import type { Options } from "./specs/fixtures.js";

// `run.ts` sets E2E_FRAMEWORKS to the frameworks it picked, so only their
// apps are built and served. Without it every framework runs.
const picked = process.env["E2E_FRAMEWORKS"]?.split(",").filter((name) => name !== "");
const selected: readonly Framework[] =
  picked === undefined ? frameworks : frameworks.filter((framework) => picked.includes(framework.name));

const origin = (framework: Framework): string => `http://127.0.0.1:${framework.port}`;

export default defineConfig<Options>({
  testDir: "specs",
  fullyParallel: true,
  // Playwright's default counts every core of the host, which in a container
  // can be far more than the container may use. This counts the usable ones.
  workers: Math.max(1, Math.floor(availableParallelism() / 2)),
  forbidOnly: process.env["CI"] !== undefined,
  reporter: process.env["CI"] === undefined ? "list" : [["list"], ["html", { open: "never" }]],
  use: { trace: "retain-on-failure" },
  // One project per framework, all running the same specs.
  projects: selected.map((framework) => ({
    name: framework.name,
    use: { ...devices["Desktop Chrome"], baseURL: origin(framework), framework },
  })),
  // One production build and one server per framework, stopped when the run ends.
  webServer: selected.map((framework) => ({
    command: `bun run --cwd apps/${framework.name} build && node server.ts apps/${framework.name} ${framework.port}`,
    url: origin(framework),
    env: { NODE_ENV: "production" },
    reuseExistingServer: false,
    timeout: 120_000,
  })),
});
