import { afterEach, expect, it, vi } from "vitest";
import { modern } from "./render.js";

// The default module, `#lunarhue/react` without the `@lunarhue/react-legacy`
// condition. Each test loads it fresh, since it checks React once at load.
const load = async () => {
  vi.resetModules();
  return import("../src/react18.js");
};

afterEach(() => {
  vi.unstubAllEnvs();
});

it.skipIf(modern)("resolves #lunarhue/react to the fallbacks before 18", async () => {
  expect(await import("#lunarhue/react")).toBe(await import("../src/legacy.js"));
});

it.runIf(modern)("resolves #lunarhue/react to React's own hooks from 18", async () => {
  expect(await import("#lunarhue/react")).toBe(await import("../src/react18.js"));
});

it.runIf(modern)("loads the default module on React 18 and later", async () => {
  const hooks = await load();
  expect(typeof hooks.useSyncExternalStore).toBe("function");
  expect(typeof hooks.useId).toBe("function");
});

it.skipIf(modern)("throws an error naming the condition in development before 18", async () => {
  vi.stubEnv("NODE_ENV", "development");
  await expect(load()).rejects.toThrow(
    "@lunarhue/forms-react: this build needs React 18 or later. On React 16.8 or 17, add the `@lunarhue/react-legacy` condition",
  );
});

it.skipIf(modern)("skips the check in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const hooks = await load();
  expect(hooks.useSyncExternalStore).toBeUndefined();
});
