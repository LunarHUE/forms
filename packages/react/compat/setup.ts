import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "./render.js";

// React 18 and later warn about updates outside `act` only when this is set.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// Every React warning fails the test. A test that expects one checks it and
// clears the spy.
beforeEach(() => {
  vi.spyOn(console, "error");
  vi.spyOn(console, "warn");
});

afterEach(async () => {
  await cleanup();
  const logged = [...vi.mocked(console.error).mock.calls, ...vi.mocked(console.warn).mock.calls];
  vi.restoreAllMocks();
  if (logged.length > 0) throw new Error(`React logged:\n${logged.map((args) => args.map(String).join(" ")).join("\n")}`);
});
