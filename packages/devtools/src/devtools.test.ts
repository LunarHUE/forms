import { createFormsCore, type Plugins, tracking } from "@lunarhue/forms-core";
import { definePlugin } from "@lunarhue/forms-core/plugins";
import { afterEach, describe, expect, it, vi } from "vitest";
import { devtools, type DevtoolsOptions, syncDevtools } from "./index.js";
import { type Hook, hookKey } from "./hook.js";

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const page = globalThis as { [hookKey]?: Hook };

const hook = (): Hook | undefined => page[hookKey];

function required(): Hook {
  const found = hook();
  if (!found) throw new Error("No devtools hook.");
  return found;
}

/** A store with `devtools(options)` and the plugins after it. */
function storeWith(options?: DevtoolsOptions, ...rest: Plugins) {
  return createFormsCore({ plugins: [devtools(options), ...rest] })
    .define({ defaultValues: { name: "", tags: [] as string[] }, onSubmit: () => "done" })
    .createStore();
}

/** Lets the panel's dynamic import settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(async () => {
  // Turn the hook off and drop it, so each test starts with no hook.
  const current = hook();
  if (current) {
    current.forms.clear();
    current.sync();
  }
  await settle();
  delete page[hookKey];
});

describe("devtools()", () => {
  it("is named devtools", () => {
    expect(devtools().name).toBe("devtools");
  });

  it("touches no global while the store is made", () => {
    const before = Object.getOwnPropertySymbols(globalThis);
    const enabled = vi.fn<() => boolean>(() => true);
    storeWith({ enabled });
    expect(Object.getOwnPropertySymbols(globalThis)).toEqual(before);
    expect(hook()).toBeUndefined();
    expect(enabled).not.toHaveBeenCalled();
  });

  it("registers a store only while it has listeners", () => {
    const store = storeWith();
    expect(hook()).toBeUndefined();
    const off = store.subscribeForm(() => {});
    const active = required();
    expect(active.version).toBe(1);
    expect([...active.forms.values()].map((entry) => entry.store)).toEqual([store]);
    off();
    expect(active.forms.size).toBe(0);
  });

  it("tells subscribers when a form comes and goes and when the hook turns on or off", () => {
    let on = true;
    const store = storeWith({ enabled: () => on });
    const first = store.subscribeForm(() => {});
    const active = required();
    const listener = vi.fn<() => void>();
    active.subscribe(listener);
    const second = storeWith().subscribeForm(() => {});
    expect(listener).toHaveBeenCalledTimes(1);
    on = false;
    syncDevtools();
    // The second form still reads true.
    expect(listener).toHaveBeenCalledTimes(1);
    second();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(active.on).toBe(false);
    first();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("keeps the last 500 writes and the last write at each path", () => {
    const store = storeWith();
    const off = store.subscribeForm(() => {});
    const [entry] = required().forms.values();
    for (let index = 0; index <= 500; index++) store.root.at("name").setValue(String(index));
    store.root.at("tags").setValue(["a"]);
    expect(entry?.writes.items).toHaveLength(500);
    expect(entry?.writes.items[0]?.seq).toBe(3);
    expect(entry?.writes.items[499]?.record).toMatchObject({ type: "value", path: ["tags"], after: ["a"] });
    expect(entry?.lastWrite.get(JSON.stringify(["name"]))).toBe(501);
    expect(entry?.lastWrite.get(JSON.stringify(["tags"]))).toBe(502);
    off();
  });

  it("logs how each submission ended, and marks one a reset ended as aborted", async () => {
    const store = storeWith();
    const off = store.subscribeForm(() => {});
    const [entry] = required().forms.values();
    await store.submit();
    const running = store.submit();
    expect(entry?.submissions.items.map((logged) => logged.status)).toEqual(["succeeded", "open"]);
    store.reset();
    await running;
    expect(entry?.submissions.items.map((logged) => logged.status)).toEqual(["succeeded", "aborted"]);
    expect(entry?.submissions.items.map((logged) => logged.seq)).toEqual([1, 2]);
    off();
  });

  it("reads enabled when the store activates, after each write and on syncDevtools", () => {
    const enabled = vi.fn<() => boolean>(() => true);
    const store = storeWith({ enabled });
    const off = store.subscribeForm(() => {});
    expect(enabled).toHaveBeenCalledTimes(1);
    store.root.at("name").setValue("a");
    expect(enabled).toHaveBeenCalledTimes(2);
    syncDevtools();
    expect(enabled).toHaveBeenCalledTimes(3);
    off();
  });

  it("clears the logs when every form reads false, and keeps the forms registered", async () => {
    let on = true;
    const store = storeWith({ enabled: () => on });
    const off = store.subscribeForm(() => {});
    const active = required();
    const [entry] = active.forms.values();
    store.root.at("name").setValue("a");
    await store.submit();
    expect(entry?.writes.items).toHaveLength(1);
    on = false;
    syncDevtools();
    expect(active.on).toBe(false);
    expect(entry?.writes.items).toHaveLength(0);
    expect(entry?.lastWrite.size).toBe(0);
    expect(entry?.submissions.items).toHaveLength(0);
    expect(active.forms.size).toBe(1);
    // Nothing is logged while off.
    store.root.at("name").setValue("b");
    expect(entry?.writes.items).toHaveLength(0);
    off();
  });

  it("holds no listener, so other plugins' onActive cleanups still run", () => {
    const cleanup = vi.fn<() => void>();
    const watcher = definePlugin({ name: "watcher", setup: () => ({ onActive: () => cleanup }) });
    const store = storeWith({}, watcher);
    const off = store.subscribeForm(() => {});
    store.root.at("name").setValue("a");
    off();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("keeps the onDisable it was given", () => {
    const onDisable = vi.fn<() => void>();
    const off = storeWith({ onDisable }).subscribeForm(() => {});
    const [entry] = required().forms.values();
    entry?.onDisable?.();
    expect(onDisable).toHaveBeenCalledTimes(1);
    off();
  });

  it("maps the elements adapters report and takes the adapter from the first one", () => {
    const store = storeWith();
    const off = store.subscribeForm(() => {});
    const active = required();
    const [entry] = active.forms.values();
    const name = store.root.at("name");
    const input = document.body.appendChild(document.createElement("input"));
    const form = document.body.appendChild(document.createElement("form"));
    tracking.record?.(input, name, true, "react");
    tracking.record?.(form, store, true, "react");
    expect(entry?.adapter).toBe("react");
    expect(active.keyOf(input)).toBe(name);
    expect(active.keyOf(form)).toBe(store);
    expect(active.elementsOf(name)).toEqual([input]);
    input.remove();
    expect(active.elementsOf(name)).toEqual([]);
    tracking.record?.(input, name, false, "react");
    expect(active.keyOf(input)).toBeUndefined();
    form.remove();
    off();
  });
});
