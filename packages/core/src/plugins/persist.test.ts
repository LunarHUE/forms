import { afterEach, describe, expect, it, vi } from "vitest";
import { createFormsCore } from "../index.js";
import { persist } from "./persist.js";
import { testStore } from "./testing.js";

const contact = () => ({ phone: "", code: "" });

/** Storage backed by a map. */
const memory = (saved = new Map<string, string>()) => ({
  saved,
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => void saved.set(key, value),
  removeItem: (key: string) => void saved.delete(key),
});

/** A storage call that throws, as blocked or full storage does. */
const blocked = () => {
  throw new Error("blocked");
};

const rethrow = (error: unknown) => {
  throw error;
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("persist", () => {
  it("saves on idle and restores at the first listener without marking anything edited", () => {
    const storage = memory();
    const { saved } = storage;
    const first = testStore({ defaultValues: contact(), plugins: [persist("contact", storage)] });
    first.store.root.at("phone").setValue("123");
    expect(saved.size).toBe(0);
    first.flush();
    expect(saved.get("contact")).toBe('{"phone":"123","code":""}');
    const second = testStore({ defaultValues: contact(), plugins: [persist("contact", storage)] });
    // Defaults until something listens, as on the server and in the render that hydrates.
    expect(second.store.root.peek().value).toEqual(contact());
    second.listen();
    expect(second.store.root.peek()).toMatchObject({ value: { phone: "123", code: "" }, edited: false });
    expect(second.server().fields[""]?.value).toEqual(contact());
    expect([first.errors, second.errors]).toEqual([[], []]);
  });

  it("restores once per store, not each time it gets listeners again", () => {
    const storage = memory(new Map([["contact", '{"phone":"1","code":""}']]));
    const { store, listen, errors } = testStore({ defaultValues: contact(), plugins: [persist("contact", storage)] });
    const stop = listen();
    stop();
    store.root.at("phone").setValue("2");
    listen();
    expect(store.getSnapshot(["phone"]).value).toBe("2");
    expect(errors).toEqual([]);
  });

  it("starts from the defaults and removes a saved value that doesn't parse", () => {
    const storage = memory(new Map([["contact", "{not json"]]));
    const { store, listen, errors } = testStore({ defaultValues: contact(), plugins: [persist("contact", storage)] });
    listen();
    expect(store.getSnapshot([]).value).toEqual(contact());
    expect(storage.saved.has("contact")).toBe(false);
    expect(errors).toEqual([]);
  });

  it("carries on when storage throws", () => {
    const reads = testStore({ defaultValues: contact(), plugins: [persist("contact", { ...memory(), getItem: blocked, removeItem: blocked })] });
    reads.listen();
    expect(reads.store.getSnapshot([]).value).toEqual(contact());
    // A full storage: the write lands and the save is dropped.
    const writes = testStore({ defaultValues: contact(), plugins: [persist("contact", { ...memory(), setItem: blocked })] });
    writes.store.root.at("phone").setValue("1");
    writes.flush();
    expect(writes.store.getSnapshot(["phone"]).value).toBe("1");
    expect([reads.errors, writes.errors]).toEqual([[], []]);
  });

  it("uses localStorage when given no storage", () => {
    const storage = memory(new Map([["contact", '{"phone":"5","code":""}']]));
    vi.stubGlobal("localStorage", storage);
    const { store, listen, flush, errors } = testStore({ defaultValues: contact(), plugins: [persist("contact")] });
    listen();
    expect(store.getSnapshot(["phone"]).value).toBe("5");
    store.root.at("phone").setValue("6");
    flush();
    expect(storage.saved.get("contact")).toBe('{"phone":"6","code":""}');
    expect(errors).toEqual([]);
  });

  // `testStore` records at every timing, so it always schedules an idle
  // delivery. Counting timers needs a store with persist alone.
  it("does nothing without localStorage, and schedules no save", () => {
    vi.useFakeTimers();
    vi.stubGlobal("localStorage", undefined);
    const server = createFormsCore({ onPluginError: rethrow }).define({ defaultValues: contact(), plugins: [persist("contact")] }).createStore();
    server.subscribeForm(() => {});
    expect(server.getSnapshot(["phone"]).value).toBe("");
    server.root.at("phone").setValue("7");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("carries on when reading the localStorage global throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    try {
      const { store, listen, errors } = testStore({ defaultValues: contact(), plugins: [persist("contact")] });
      listen();
      expect(store.getSnapshot([]).value).toEqual(contact());
      expect(errors).toEqual([]);
    } finally {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
});
