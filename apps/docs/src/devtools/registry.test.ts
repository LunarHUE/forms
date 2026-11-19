import { describe, expect, it, vi } from "vitest";

import { createRegistry, type RegistryState } from "./registry";

const contact = { id: "demo-1", name: "contact", element: null };
const signup = { id: "demo-2", name: "signup", element: null };

describe("registry", () => {
  it("lists forms in registration order", () => {
    const registry = createRegistry();
    registry.register(contact);
    registry.register(signup);
    expect(registry.list().map((form) => form.name)).toEqual(["contact", "signup"]);
  });

  it("replaces an entry with the same id in place and keeps it selected", () => {
    const registry = createRegistry();
    registry.register(contact);
    registry.register(signup);
    registry.select("demo-1");
    registry.register({ ...contact, name: "contact again" });
    expect(registry.list().map((form) => form.name)).toEqual(["contact again", "signup"]);
    expect(registry.selected()?.name).toBe("contact again");
  });

  it("selects by id, ignores unknown ids and clears with null", () => {
    const registry = createRegistry();
    registry.register(contact);
    registry.select("nope");
    expect(registry.selected()).toBeUndefined();
    registry.select("demo-1");
    expect(registry.selected()).toBe(contact);
    registry.select(null);
    expect(registry.getState().selected).toBeNull();
  });

  it("clears the selection when the selected form unregisters", () => {
    const registry = createRegistry();
    registry.register(contact);
    registry.register(signup);
    registry.select("demo-2");
    registry.unregister("demo-1");
    expect(registry.getState().selected).toBe("demo-2");
    registry.unregister("demo-2");
    expect(registry.getState()).toEqual({ forms: [], selected: null });
  });

  it("notifies subscribers on changes only, until they unsubscribe", () => {
    const registry = createRegistry();
    const listener = vi.fn<(state: RegistryState) => void>();
    const unsubscribe = registry.subscribe(listener);
    registry.register(contact);
    registry.select("demo-1");
    registry.select("demo-1");
    registry.unregister("missing");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(registry.getState());
    unsubscribe();
    registry.select(null);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps the same state object between changes", () => {
    const registry = createRegistry();
    registry.register(contact);
    const before = registry.getState();
    registry.select("missing");
    expect(registry.getState()).toBe(before);
  });
});
