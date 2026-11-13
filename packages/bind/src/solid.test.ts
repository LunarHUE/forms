import { createFormsCore, type WriteRecord } from "@lunarhue/forms-core";
import { definePlugin } from "@lunarhue/forms-core/plugins";
import { dirty } from "@lunarhue/forms-core/plugins/dirty";
import type { Resolve } from "@lunarhue/forms-core/plugins/rebase";
import { createMemo, createRoot, createSignal, flush, getOwner, type Setter } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { signal } from "./solid.js";

interface Profile {
  name: string;
  email: string;
}

const defaults: Profile = { name: "", email: "" };
const profile = createFormsCore({ plugins: [dirty()] }).define({ defaultValues: defaults });

/** A signal whose setter counts the writes that reach it. */
function counted(value: Profile) {
  const [get, set] = createSignal(value);
  const writes = vi.fn<Setter<Profile>>(set);
  return { get, set, writes };
}

/** Collects the records of every form write the binding makes itself. */
function spy() {
  const seen: WriteRecord[] = [];
  const plugin = definePlugin({
    name: "spy",
    setup: () => ({
      onWrite(records) {
        for (const record of records) {
          if (typeof record.cause === "object" && record.cause.plugin === "bind") seen.push(record);
        }
      },
    }),
  });
  return { seen, plugin };
}

describe("signal", () => {
  it("starts the form from the signal", () => {
    const [get, set] = createSignal<Profile>({ name: "Ada", email: "ada@x" });
    const form = profile.createStore(undefined, { plugins: [signal(get, set)] });
    expect(form.root.peek().value).toEqual({ name: "Ada", email: "ada@x" });
    expect(form.getFormSnapshot().dirty).toBe(false);
  });

  it("copies a signal change into the form once Solid flushes", () => {
    const [get, set] = createSignal<Profile>({ name: "Ada", email: "ada@x" });
    const form = profile.createStore(undefined, { plugins: [signal(get, set)] });
    const stop = form.subscribeForm(() => {});
    flush();

    set({ name: "Grace", email: "grace@x" });
    flush();
    expect(form.root.peek().value).toEqual({ name: "Grace", email: "grace@x" });
    stop();
  });

  it("copies a form write to the signal", () => {
    const [get, set] = createSignal<Profile>({ name: "Ada", email: "ada@x" });
    const form = profile.createStore(undefined, { plugins: [signal(get, set)] });
    const stop = form.subscribeForm(() => {});
    flush();

    form.root.at("name").setValue("Grace");
    flush();
    expect(get()).toEqual({ name: "Grace", email: "ada@x" });
    stop();
  });

  it("doesn't echo a write back to where it came from", () => {
    const source = counted({ name: "Ada", email: "ada@x" });
    const { seen, plugin } = spy();
    const form = profile.createStore(undefined, { plugins: [signal(source.get, source.writes), plugin] });
    const stop = form.subscribeForm(() => {});
    flush();

    // Form to signal: one write out, none back in, and the field stays edited.
    form.root.at("name").setValue("Grace");
    form.root.at("email").setValue("grace@x");
    flush();
    expect(source.writes).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([]);
    expect(form.changes()).toEqual([
      { path: ["name"], baseline: "Ada", value: "Grace" },
      { path: ["email"], baseline: "ada@x", value: "grace@x" },
    ]);

    // Signal to form: one write in, none back out.
    source.set({ name: "Outside", email: "o@x" });
    flush();
    expect(form.root.peek().value).toEqual({ name: "Outside", email: "o@x" });
    expect(seen.length).toBeGreaterThan(0);
    expect(source.writes).toHaveBeenCalledTimes(2);
    stop();
  });

  it("doesn't take its own write back as an outside change", () => {
    // `incoming` runs for each leaf an outside change touches, so an echo of the edit would call it.
    const incoming = vi.fn<Resolve>(() => "keep");
    const [get, set] = createSignal<Profile>({ name: "Ada", email: "ada@x" });
    const form = profile.createStore(undefined, { plugins: [signal(get, set, { incoming })] });
    const stop = form.subscribeForm(() => {});
    flush();

    form.root.at("name").setValue("Grace");
    flush();
    expect(get()).toEqual({ name: "Grace", email: "ada@x" });
    expect(incoming).not.toHaveBeenCalled();

    set({ name: "Grace", email: "new@x" });
    flush();
    expect(incoming).toHaveBeenCalledOnce();
    stop();
  });

  it("takes a signal change made after a form write in the same batch", () => {
    const [get, set] = createSignal<Profile>({ name: "Ada", email: "ada@x" });
    const form = profile.createStore(undefined, { plugins: [signal(get, set)] });
    const stop = form.subscribeForm(() => {});
    flush();

    form.root.at("name").setValue("Grace");
    set({ name: "Outside", email: "o@x" });
    flush();
    expect(form.root.peek().value).toEqual({ name: "Outside", email: "o@x" });

    // And a change back to a value the signal held before.
    set({ name: "Ada", email: "ada@x" });
    flush();
    expect(form.root.peek().value).toEqual({ name: "Ada", email: "ada@x" });
    stop();
  });

  it("disposes its root when the form has no listeners", () => {
    const [get, set] = createSignal<Profile>({ name: "Ada", email: "ada@x" });
    const form = profile.createStore(undefined, { plugins: [signal(get, set)] });
    const stop = form.subscribeForm(() => {});
    flush();
    stop();

    set({ name: "Gone", email: "gone@x" });
    flush();
    expect(form.root.peek().value).toEqual({ name: "Ada", email: "ada@x" });

    // Listening again catches up with the signal.
    const again = form.subscribeForm(() => {});
    flush();
    expect(form.root.peek().value).toEqual({ name: "Gone", email: "gone@x" });
    again();
  });

  it("listens and writes from inside an owner without warnings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const [get, set] = createSignal<Profile>({ name: "Ada", email: "ada@x" });
      const form = profile.createStore(undefined, { plugins: [signal(get, set, { initial: "form" })] });
      // A memo is where the Solid adapter subscribes; this one starts the binding, which writes the defaults out.
      const dispose = createRoot((disposeRoot) => {
        createMemo(() => {
          expect(getOwner()).not.toBeNull();
          return form.subscribeForm(() => {});
        });
        return disposeRoot;
      });
      flush();
      expect(get()).toEqual(defaults);

      set({ name: "Grace", email: "grace@x" });
      flush();
      expect(form.root.peek().value).toEqual({ name: "Grace", email: "grace@x" });
      dispose();
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it("passes incoming and initial through", () => {
    const [get, set] = createSignal<Profile>({ name: "Ada", email: "ada@x" });
    const form = profile.createStore(undefined, { plugins: [signal(get, set, { initial: "form", incoming: "rebase" })] });
    expect(form.root.peek().value).toEqual(defaults);
    const stop = form.subscribeForm(() => {});
    flush();
    expect(get()).toEqual(defaults);

    form.root.at("name").setValue("mine");
    set({ name: "server", email: "server@x" });
    flush();
    expect(form.root.peek().value).toEqual({ name: "mine", email: "server@x" });
    expect(form.changes()).toEqual([{ path: ["name"], baseline: "server", value: "mine" }]);
    stop();
  });
});
