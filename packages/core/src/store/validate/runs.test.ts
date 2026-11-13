import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorMap, FormError } from "../../errors.js";
import type { Path } from "../../path.js";
import type { StandardSchemaV1 } from "../../standard-schema.js";
import type { PlatformAbortSignal } from "../../value.js";
import { validation as runner } from "../../plugins/validation.js";
import { createFormInternals, type FormStoreOptions } from "../form-store.js";

type Options<V> = Omit<FormStoreOptions<V>, "id" | "initial">;

// Core declares no timer globals, so the tests declare the one they use.
declare function setTimeout(run: () => void, ms: number): unknown;

/** A field check, typed for `vi.fn`. */
type Check = (value: unknown) => FormError | undefined;

const make = <V>(initial: V, options: Options<V> = {}) => {
  const parts = createFormInternals<V>({ id: "f", initial, plugins: [runner()], ...options });
  const root = parts.store.fieldAt([]);
  if (!root) throw new Error("no root");
  const messages = (path: Path) => parts.store.getSnapshot(path).errors.map((error) => error.message);
  const validating = (path: Path) => parts.store.getSnapshot(path).validating;
  return { ...parts, root, messages, validating };
};

const err = (message: string): FormError => ({ message });

const schema = <T = unknown>(validate: (value: unknown) => StandardSchemaV1.Result<unknown>): StandardSchemaV1<T, unknown> => ({
  "~standard": { version: 1, vendor: "fake", validate },
});

const required = (value: unknown) => (value === "" ? err("Required") : undefined);

/** A check that resolves to `error` after `ms`, recording each call's signal. */
const slow = (ms: number, error: FormError | undefined, signals: PlatformAbortSignal[] = []) =>
  vi.fn<(value: unknown, ctx: { readonly signal: PlatformAbortSignal }) => Promise<FormError | undefined>>((_value, ctx) => {
    signals.push(ctx.signal);
    return new Promise<FormError | undefined>((resolve) => setTimeout(() => resolve(error), ms));
  });

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

describe("validate.fields", () => {
  it("reads a record of child entries", () => {
    const { root, messages } = make(
      { user: { name: "", email: "" } },
      { timing: "input", validate: { fields: { user: { name: required, email: schema(() => ({ issues: [{ message: "Email" }] })) } } } },
    );
    root.at("user").setValue({ name: "", email: "x" });
    expect(messages(["user", "name"])).toEqual(["Required"]);
    expect(messages(["user", "email"])).toEqual(["Email"]);
  });

  it("reads the options-object form", async () => {
    const check = vi.fn<Check>(required);
    const { root, messages } = make({ name: "x" }, { validate: { fields: { name: { validate: check, debounce: 50, on: "input" } } } });
    root.at("name").setValue("");
    expect(check).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    expect(messages(["name"])).toEqual(["Required"]);
  });

  it("applies a tuple entry to every item, including items added, moved and removed", async () => {
    const check = vi.fn<Check>(required);
    const { root, messages, validation } = make({ rows: [{ t: "" }, { t: "x" }] }, { validate: { fields: { rows: [{ t: check }] } } });
    const rows = root.at("rows");
    rows.item("k0").at("t").handleBlur();
    expect(messages(["rows", "k0", "t"])).toEqual(["Required"]);
    expect(check).toHaveBeenCalledTimes(1);

    rows.push({ t: "" });
    rows.item("k2").at("t").handleBlur();
    expect(messages(["rows", "k2", "t"])).toEqual(["Required"]);

    // The item keeps its validator and its errors when it moves.
    rows.move(0, 2);
    expect(messages(["rows", "k0", "t"])).toEqual(["Required"]);
    rows.item("k0").at("t").setValue("ok");
    expect(messages(["rows", "k0", "t"])).toEqual([]);

    rows.remove(2);
    await validation.settleForSubmit();
    expect(messages(["rows", "k2", "t"])).toEqual(["Required"]);
    expect(messages(["rows", "k1", "t"])).toEqual([]);
  });

  it("arms items added after submit", async () => {
    const noRows: { t: string }[] = [];
    const { root, validation, messages } = make({ rows: noRows }, { validate: { fields: { rows: [{ t: required }] } } });
    await validation.settleForSubmit();
    root.at("rows").push({ t: "x" });
    root.at("rows").item("k0").at("t").setValue("");
    expect(messages(["rows", "k0", "t"])).toEqual(["Required"]);
  });

  it("aborts a run on a removed item and never writes to it", async () => {
    const signals: PlatformAbortSignal[] = [];
    const check = slow(20, err("Late"), signals);
    const { root, store } = make({ rows: [{ t: "" }] }, { timing: "input", validate: { fields: { rows: [{ t: check }] } } });
    root.at("rows").item("k0").at("t").setValue("x");
    expect(store.getFormSnapshot().validating).toBe(true);
    root.at("rows").remove(0);
    expect(signals[0]?.aborted).toBe(true);
    expect(store.getFormSnapshot().validating).toBe(false);
    await vi.runAllTimersAsync();
    expect(store.getSnapshot(["rows", "k0", "t"]).errors).toEqual([]);
  });

  it("drops a result for an item removed without a user edit", async () => {
    const { root, store } = make({ rows: [{ t: "" }] }, { timing: "input", validate: { fields: { rows: [{ t: slow(20, err("Late")) }] } } });
    root.at("rows").item("k0").at("t").setValue("x");
    root.at("rows").remove(0, { edited: false });
    await vi.runAllTimersAsync();
    expect(store.getSnapshot(["rows", "k0", "t"]).errors).toEqual([]);
    expect(store.getFormSnapshot().valid).toBe(true);
  });
});

describe("register", () => {
  it("combines several validators on one field in registration order", () => {
    const { root, messages } = make({ name: "" }, { timing: "input" });
    root.at("name").registerValidator(() => err("One"));
    root.at("name").registerValidator(schema(() => ({ issues: [{ message: "Two" }] })));
    root.at("name").setValue("x");
    expect(messages(["name"])).toEqual(["One", "Two"]);
  });

  it("removes its errors and validating marks, and aborts its run", async () => {
    const signals: PlatformAbortSignal[] = [];
    const { root, store, messages, validating } = make({ a: "", b: "" }, { timing: "input" });
    const offSync = root.at("a").registerValidator(() => err("Sync"));
    const offAsync = root.at("b").registerValidator(slow(20, err("Async"), signals));
    root.setValue({ a: "x", b: "x" });
    expect(messages(["a"])).toEqual(["Sync"]);
    expect(validating(["b"])).toBe(true);
    offSync();
    offAsync();
    expect(messages(["a"])).toEqual([]);
    expect(validating(["b"])).toBe(false);
    expect(signals[0]?.aborted).toBe(true);
    await vi.runAllTimersAsync();
    expect(messages(["b"])).toEqual([]);
    expect(store.getFormSnapshot().valid).toBe(true);
    offSync();
  });
});

describe("settleForSubmit", () => {
  it("runs validators that never ran, threw or recheck, and leaves current ones", async () => {
    let fail = true;
    const fresh = vi.fn<Check>(() => undefined);
    const current = vi.fn<Check>(() => undefined);
    const thrower = vi.fn<Check>(() => {
      if (fail) throw new Error("Boom");
      return undefined;
    });
    const recheck = vi.fn<Check>(() => undefined);
    const { root, validation, messages } = make({ a: "", b: "", c: "", d: "" }, { timing: "input" });
    root.at("a").registerValidator(fresh);
    root.at("b").registerValidator(current);
    root.at("c").registerValidator(thrower);
    root.at("d").registerValidator({ validate: recheck, recheckOnSubmit: true });
    root.at("b").setValue("x");
    root.at("c").setValue("x");
    root.at("d").setValue("x");
    expect(messages(["c"])).toEqual(["Boom"]);
    fail = false;
    await validation.settleForSubmit();
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(current).toHaveBeenCalledTimes(1);
    expect(thrower).toHaveBeenCalledTimes(2);
    expect(recheck).toHaveBeenCalledTimes(2);
    expect(messages(["c"])).toEqual([]);
  });

  it("resolves only once every running check has landed", async () => {
    const { root, validation, messages, store } = make({ a: "", b: "" }, { timing: "input" });
    root.at("a").registerValidator({ validate: slow(30, err("Slow")), debounce: 500 });
    root.at("b").registerValidator(slow(10, undefined));
    root.setValue({ a: "x", b: "x" });
    let done = false;
    void validation.settleForSubmit().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(29);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(messages(["a"])).toEqual(["Slow"]);
    expect(store.getFormSnapshot().validating).toBe(false);
  });
});

describe("validate(path)", () => {
  it("runs validators at and below the path, not above, and reports the subtree", async () => {
    const above = vi.fn<Check>(() => err("Above"));
    const at = vi.fn<Check>(() => undefined);
    const under = vi.fn<Check>(required);
    const { root, store, messages } = make(
      { user: { name: "", rows: [{ t: "" }, { t: "x" }] } },
      { validate: { form: () => ({ form: err("Form") }), fields: { user: { rows: [{ t: under }] } } } },
    );
    root.registerValidator(above);
    root.at("user").registerValidator(at);
    expect(await root.at("user").validate()).toBe(false);
    expect(above).not.toHaveBeenCalled();
    expect(at).toHaveBeenCalledTimes(1);
    expect(under).toHaveBeenCalledTimes(2);
    expect(messages([])).toEqual([]);
    expect(messages(["user", "rows", "k0", "t"])).toEqual(["Required"]);
    expect(await root.at("user").at("rows").item("k1").validate()).toBe(true);
    expect(await store.validate()).toBe(false);
    expect(above).toHaveBeenCalledTimes(1);
    expect(messages([])).toEqual(["Form", "Above"]);
  });

  it("waits for async checks", async () => {
    const { root } = make({ a: "" });
    root.at("a").registerValidator(slow(20, err("No")));
    const result = root.at("a").validate();
    await vi.advanceTimersByTimeAsync(20);
    expect(await result).toBe(false);
  });
});

describe("reset", () => {
  it("aborts runs, drops debounces and puts validators back to not-yet-run", async () => {
    const signals: PlatformAbortSignal[] = [];
    const debounced = vi.fn<Check>(() => err("D"));
    const blurred = vi.fn<Check>(required);
    const { root, core, validation, validating } = make({ a: "", b: "", c: "" });
    root.at("a").registerValidator({ validate: slow(20, err("A"), signals), on: "input" });
    root.at("b").registerValidator({ validate: debounced, on: "input", debounce: 50 });
    root.at("c").registerValidator(blurred);
    root.at("c").handleBlur();
    root.setValue({ a: "x", b: "x", c: "" });
    expect(validating(["a"])).toBe(true);
    core.batch(() => validation.reset([]));
    expect(signals[0]?.aborted).toBe(true);
    expect(validating(["a"])).toBe(false);
    expect(validating(["b"])).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    await vi.runAllTimersAsync();
    expect(debounced).not.toHaveBeenCalled();
    // Blur timing again: a write doesn't run it until the next blur.
    const calls = blurred.mock.calls.length;
    root.at("c").setValue("y");
    expect(blurred).toHaveBeenCalledTimes(calls);
    root.at("c").handleBlur();
    expect(blurred).toHaveBeenCalledTimes(calls + 1);
  });

  it("resets only the subtree", () => {
    const a = vi.fn<Check>(() => undefined);
    const b = vi.fn<Check>(() => undefined);
    const { root, core, validation } = make({ x: { a: "" }, y: { b: "" } });
    root.at("x").at("a").registerValidator(a);
    root.at("y").at("b").registerValidator(b);
    root.at("x").at("a").handleBlur();
    root.at("y").at("b").handleBlur();
    core.batch(() => validation.reset(["x"]));
    root.setValue({ x: { a: "1" }, y: { b: "1" } });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});

describe("blur and form-level validators", () => {
  const formSchema = schema(() => ({
    issues: [{ message: "Root" }, { message: "A", path: ["a"] }, { message: "B", path: ["b"] }, { message: "T", path: ["rows", 0, "t"] }],
  }));

  it("runs a blur-timed form schema for the blurred field only", async () => {
    const { root, validation, messages } = make({ a: "", b: "", rows: [{ t: "" }] }, { schema: formSchema });
    root.at("a").handleBlur();
    expect(messages(["a"])).toEqual(["A"]);
    expect(messages(["b"])).toEqual([]);
    expect(messages([])).toEqual([]);
    // Writes run it again, still for blurred fields only.
    root.at("b").setValue("x");
    expect(messages(["b"])).toEqual([]);
    root.at("rows").item("k0").handleBlur();
    expect(messages(["rows", "k0", "t"])).toEqual(["T"]);
    await validation.settleForSubmit();
    expect(messages(["b"])).toEqual(["B"]);
    expect(messages([])).toEqual(["Root"]);
  });

  it("does the same for an ErrorMap form validator", () => {
    const check = vi.fn<() => ErrorMap<FormError>>(() => ({ form: err("F"), fields: { a: err("A"), b: err("B") } }));
    const { root, messages } = make({ a: "", b: "" }, { validate: { form: check } });
    root.at("b").handleBlur();
    root.at("b").handleBlur();
    expect(check).toHaveBeenCalledTimes(1);
    expect(messages(["a"])).toEqual([]);
    expect(messages(["b"])).toEqual(["B"]);
  });

  it("forgets the blurred fields of a reset subtree", () => {
    const { root, core, validation, messages } = make({ a: "", b: "" }, { schema: formSchema });
    root.at("a").handleBlur();
    core.batch(() => {
      validation.reset(["a"]);
      core.clearState(["a"], { validation: true });
    });
    root.at("b").setValue("y");
    expect(messages(["a"])).toEqual([]);
  });
});

describe("cost", () => {
  it("runs only the validators that touch the written field in a form with many rows", () => {
    const n = 3000;
    const rows: { t: string; u: string }[] = Array.from({ length: n }, () => ({ t: "", u: "" }));
    const t = vi.fn<Check>(required);
    const u = vi.fn<Check>(required);
    const row = vi.fn<Check>(() => undefined);
    const form = vi.fn<() => undefined>(() => undefined);
    const { root, core } = make(
      { rows },
      { validate: { form: { validate: form, on: "input" }, fields: { rows: [{ t: { validate: t, on: "input" }, u }] } } },
    );
    root.at("rows").item("k1500").at("u").handleBlur();
    root.registerValidator(() => undefined);
    root.at("rows").item("k7").registerValidator(row);
    const reads = vi.spyOn(core, "getSnapshot");
    root.at("rows").item("k2000").at("t").setValue("a");
    expect(t).toHaveBeenCalledTimes(1);
    expect(u).toHaveBeenCalledTimes(1);
    expect(row).not.toHaveBeenCalled();
    expect(form).toHaveBeenCalledTimes(1);
    expect(reads.mock.calls.length).toBeLessThan(20);
    reads.mockClear();
    root.at("rows").item("k1500").at("u").setValue("a");
    expect(u).toHaveBeenCalledTimes(2);
    expect(t).toHaveBeenCalledTimes(1);
    expect(reads.mock.calls.length).toBeLessThan(20);
  });
});
