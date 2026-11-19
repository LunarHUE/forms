// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { boot, bootScript } from "./boot";
import {
  BOOT_CONFIG,
  DEFAULT_STATE,
  getServerState,
  getState,
  resetStoreForTests,
  setFramework,
  setPackageManager,
  setTheme,
  subscribe,
} from "./store";

// jsdom has no matchMedia. This one reports the OS theme and lets a test flip it.
let osDark = false;
const mediaListeners = new Set<() => void>();
const stubMatchMedia = () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return osDark;
    },
    addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener),
  }));
};
const setOsDark = (dark: boolean) => {
  osDark = dark;
  for (const listener of mediaListeners) listener();
};

const root = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  osDark = false;
  mediaListeners.clear();
  stubMatchMedia();
  root().className = "";
  for (const key of Object.keys(root().dataset)) delete root().dataset[key];
  resetStoreForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("store", () => {
  it("starts from the defaults", () => {
    expect(getState()).toEqual(DEFAULT_STATE);
    expect(getServerState()).toEqual(DEFAULT_STATE);
  });

  it("reads saved settings and ignores unknown values", () => {
    localStorage.setItem("forms:theme", "dark");
    localStorage.setItem("forms:pm", "cargo");
    localStorage.setItem("forms:framework", "solid");
    expect(getState()).toEqual({ theme: "dark", pm: "bun", framework: "solid" });
  });

  it("persists a change, updates <html> and notifies subscribers", () => {
    const listener = vi.fn<() => void>();
    subscribe(listener);
    setPackageManager("pnpm");
    expect(getState().pm).toBe("pnpm");
    expect(localStorage.getItem("forms:pm")).toBe("pnpm");
    expect(root().dataset.pm).toBe("pnpm");
    expect(listener).toHaveBeenCalledTimes(1);

    setPackageManager("pnpm");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn<() => void>();
    const unsubscribe = subscribe(listener);
    unsubscribe();
    setTheme("dark");
    expect(listener).not.toHaveBeenCalled();
  });

  it("resolves the system theme from the OS", () => {
    osDark = true;
    setTheme("light");
    expect(root().classList.contains("dark")).toBe(false);
    setTheme("system");
    expect(root().classList.contains("dark")).toBe(true);
    expect(root().dataset.theme).toBe("system");
    setTheme("dark");
    expect(localStorage.getItem("forms:theme")).toBe("dark");
  });

  it("records the framework", () => {
    setFramework("solid");
    expect(localStorage.getItem("forms:framework")).toBe("solid");
    expect(root().dataset.framework).toBe("solid");
  });

  it("picks up changes from other tabs", () => {
    const listener = vi.fn<() => void>();
    subscribe(listener);
    localStorage.setItem("forms:pm", "yarn");
    globalThis.dispatchEvent(new StorageEvent("storage", { key: "forms:pm", newValue: "yarn" }));
    expect(getState().pm).toBe("yarn");
    expect(root().dataset.pm).toBe("yarn");
    expect(listener).toHaveBeenCalledTimes(1);

    globalThis.dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "x" }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps working when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getState()).toEqual(DEFAULT_STATE);
    setPackageManager("npm");
    expect(getState().pm).toBe("npm");
    expect(root().dataset.pm).toBe("npm");
    vi.restoreAllMocks();
  });
});

describe("boot", () => {
  it("applies saved settings", () => {
    localStorage.setItem("forms:theme", "dark");
    localStorage.setItem("forms:pm", "yarn");
    localStorage.setItem("forms:framework", "solid");
    boot(BOOT_CONFIG, null);
    expect(root().classList.contains("dark")).toBe(true);
    expect(root().dataset.theme).toBe("dark");
    expect(root().dataset.pm).toBe("yarn");
    expect(root().dataset.framework).toBe("solid");
  });

  it("records the page's framework", () => {
    localStorage.setItem("forms:framework", "solid");
    boot(BOOT_CONFIG, "react");
    expect(root().dataset.framework).toBe("react");
    expect(localStorage.getItem("forms:framework")).toBe("react");
  });

  it("follows the OS while the theme is system", () => {
    boot(BOOT_CONFIG, null);
    expect(root().dataset.theme).toBe("system");
    expect(root().classList.contains("dark")).toBe(false);
    setOsDark(true);
    expect(root().classList.contains("dark")).toBe(true);

    // A later choice in the store wins over the OS.
    setTheme("light");
    setOsDark(true);
    expect(root().classList.contains("dark")).toBe(false);
  });

  it("serializes to a script that runs on its own", () => {
    localStorage.setItem("forms:pm", "npm");
    // oxlint-disable-next-line typescript/no-implied-eval -- the point is to run the serialized text
    new Function(bootScript("solid"))();
    expect(root().dataset.pm).toBe("npm");
    expect(root().dataset.framework).toBe("solid");
  });
});
