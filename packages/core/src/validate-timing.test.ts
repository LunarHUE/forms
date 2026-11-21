import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormError } from "./errors.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import type { PlatformAbortSignal } from "./value.js";
import { createFormInternals, type FormStoreOptions } from "./store/form-store.js";
import { debounced, pipe, recheckOnSubmit, validateOn } from "./validate-timing.js";
import { formValidator } from "./index.js";

const make = <V>(initial: V, options: Omit<FormStoreOptions<V>, "id" | "initial"> = {}) => {
  const parts = createFormInternals<V>({ id: "f", initial, ...options });
  const root = parts.store.fieldAt([]);
  if (!root) throw new Error("no root");
  const messages = (path: string[]) => parts.store.getSnapshot(path).errors.map((error) => error.message);
  const validating = (path: string[]) => parts.store.getSnapshot(path).validating;
  return { ...parts, root, messages, validating };
};

const err = (message: string): FormError => ({ message });
const required = (value: unknown) => (value === "" ? err("Required") : undefined);
const short = (value: unknown) => (typeof value === "string" && value.length < 3 ? err("Short") : undefined);

/** A schema that fails on an empty string, counting its calls. */
const requiredSchema = () => {
  const validate = vi.fn<(value: unknown) => StandardSchemaV1.Result<unknown>>((value) =>
    value === "" ? { issues: [{ message: "Schema required" }] } : { value },
  );
  const schema: StandardSchemaV1<string, unknown> = { "~standard": { version: 1, vendor: "fake", validate } };
  return { schema, validate };
};

// Core declares no timer globals, so the tests declare the one they use.
declare function setTimeout(run: () => void, ms: number): unknown;

/** A context with a signal that `abort` aborts, for calling a check directly. */
const context = () => {
  const listeners: (() => void)[] = [];
  const signal = { aborted: false, addEventListener: (_type: string, run: () => void) => void listeners.push(run) };
  const abort = () => {
    signal.aborted = true;
    for (const run of listeners) run();
  };
  // The fake has what the checks here read.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { ctx: { signal: signal as unknown as PlatformAbortSignal }, abort };
};

/** A check that resolves to `error` after `ms`. */
const later = (ms: number, error: FormError | undefined) =>
  vi.fn<(value: unknown) => Promise<FormError | undefined>>(() => new Promise((resolve) => setTimeout(() => resolve(error), ms)));

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

describe("debounced", () => {
  it("runs a schema once the input pauses, and a newer write cancels the wait", async () => {
    const { schema, validate } = requiredSchema();
    const { root, messages, validating } = make({ name: "x" }, { timing: "input" });
    root.at("name").registerValidator(debounced(schema, 100));
    root.at("name").setValue("");
    await vi.advanceTimersByTimeAsync(60);
    root.at("name").setValue("y");
    root.at("name").setValue("");
    expect(validating(["name"])).toBe(true);
    await vi.advanceTimersByTimeAsync(60);
    expect(validate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(40);
    expect(validate).toHaveBeenCalledTimes(1);
    expect(messages(["name"])).toEqual(["Schema required"]);
    expect(validating(["name"])).toBe(false);
  });

  it("skips the wait on validate()", async () => {
    const check = vi.fn<typeof required>(required);
    const { root, messages } = make({ name: "" }, { timing: "input" });
    root.at("name").registerValidator(debounced(check, 1000));
    root.at("name").setValue("");
    const valid = root.at("name").validate();
    await vi.advanceTimersByTimeAsync(0);
    expect(await valid).toBe(false);
    expect(check).toHaveBeenCalledTimes(1);
    expect(messages(["name"])).toEqual(["Required"]);
  });

  it("never calls the check when the validator goes away during the wait", async () => {
    const check = vi.fn<typeof required>(required);
    const { root, validating } = make({ name: "x" }, { timing: "input" });
    const remove = root.at("name").registerValidator(debounced(check, 100));
    root.at("name").setValue("");
    remove();
    await vi.advanceTimersByTimeAsync(200);
    expect(check).not.toHaveBeenCalled();
    expect(validating(["name"])).toBe(false);
  });
});

describe("wrappers nest in any order", () => {
  it.each([
    ["debounced outside", (check: typeof required) => debounced(validateOn(check, "input"), 50)],
    ["validateOn outside", (check: typeof required) => validateOn(debounced(check, 50), "input")],
  ])("%s", async (_name, wrap) => {
    const check = vi.fn<typeof required>(required);
    // The form's timing is submit, so only `validateOn` makes the write run it.
    const { root, messages } = make({ name: "x" }, { timing: "submit" });
    root.at("name").registerValidator(wrap(check));
    root.at("name").setValue("");
    expect(check).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    expect(messages(["name"])).toEqual(["Required"]);
  });

  it("keeps every tag on a wrapped schema", async () => {
    const { schema, validate } = requiredSchema();
    const { root, messages, validation } = make({ name: "x" }, { timing: "submit" });
    root.at("name").registerValidator(recheckOnSubmit(validateOn(debounced(schema, 50), "input")));
    root.at("name").setValue("");
    await vi.advanceTimersByTimeAsync(50);
    expect(messages(["name"])).toEqual(["Schema required"]);
    await validation.settleForSubmit();
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("leaves the check it wraps as it was", () => {
    const check = vi.fn<typeof required>(required);
    const wrapped = validateOn(check, "input");
    expect(wrapped).not.toBe(check);
    expect("~on" in check).toBe(false);
  });
});

describe("validateOn", () => {
  it("overrides the form's timing for a form validator", () => {
    const form = vi.fn<(value: { a: string }) => { fields: { a: FormError } } | undefined>((value) => (value.a === "" ? { fields: { a: err("A") } } : undefined));
    const { root, messages } = make({ a: "x" }, { timing: "submit", validate: { form: formValidator(validateOn(form, "input")) } });
    root.at("a").setValue("");
    expect(messages(["a"])).toEqual(["A"]);
  });
});

describe("pipe", () => {
  it("answers at once while every check does, and stops at the first error", () => {
    const after = vi.fn<typeof required>(required);
    const check = pipe(required, short, after);
    const { ctx } = context();
    expect(check("", ctx)).toEqual(err("Required"));
    expect(check("ab", ctx)).toEqual(err("Short"));
    expect(after).not.toHaveBeenCalled();
    expect(check("abc", ctx)).toBeUndefined();
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("passes on null, an empty list and an ErrorMap with no errors", () => {
    const last = vi.fn<() => FormError>(() => err("Last"));
    const { ctx } = context();
    expect(pipe(() => null, () => [], () => ({}), () => ({ form: [], fields: { a: undefined, b: [] } }), last)("x", ctx)).toEqual(err("Last"));
    expect(pipe(() => ({ fields: { a: err("A") } }), last)("x", ctx)).toEqual({ fields: { a: err("A") } });
    expect(last).toHaveBeenCalledTimes(1);
  });

  it("never starts a debounced check after a sync error, so the field never shows validating", () => {
    const lookup = vi.fn<typeof required>(() => err("Taken"));
    const { root, messages, validating } = make({ name: "x" }, { timing: "input" });
    root.at("name").registerValidator(pipe(short, debounced(lookup, 400)));
    root.at("name").setValue("ab");
    expect(messages(["name"])).toEqual(["Short"]);
    expect(validating(["name"])).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("waits for a debounced check once the sync checks pass", async () => {
    const lookup = vi.fn<typeof required>(() => err("Taken"));
    const { root, messages, validating } = make({ name: "x" }, { timing: "input" });
    root.at("name").registerValidator(pipe(short, debounced(lookup, 400)));
    root.at("name").setValue("abc");
    expect(validating(["name"])).toBe(true);
    // A sync error replaces the wait at once.
    root.at("name").setValue("ab");
    expect(validating(["name"])).toBe(false);
    expect(messages(["name"])).toEqual(["Short"]);
    root.at("name").setValue("abcd");
    await vi.advanceTimersByTimeAsync(400);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(messages(["name"])).toEqual(["Taken"]);
    expect(validating(["name"])).toBe(false);
  });

  it("goes on after an async check passes and stops after one fails", async () => {
    const first = later(10, undefined);
    const failing = later(10, err("Async"));
    const after = vi.fn<typeof required>(() => err("After"));
    const { ctx } = context();
    const passing = pipe(first, after)("x", ctx);
    expect(passing).toBeInstanceOf(Promise);
    await vi.advanceTimersByTimeAsync(10);
    expect(await passing).toEqual(err("After"));
    const stopped = pipe(failing, after)("x", ctx);
    await vi.advanceTimersByTimeAsync(10);
    expect(await stopped).toEqual(err("Async"));
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("stops after an aborted async check", async () => {
    const after = vi.fn<typeof required>(() => err("After"));
    const { ctx, abort } = context();
    const run = pipe(later(10, undefined), after)("x", ctx);
    abort();
    await vi.advanceTimersByTimeAsync(10);
    expect(await run).toBeUndefined();
    expect(after).not.toHaveBeenCalled();
  });

  it("lets a newer run win and never calls the older run's later checks", async () => {
    const lookup = vi.fn<typeof required>(() => err("Taken"));
    const { root, messages } = make({ name: "x" }, { timing: "input" });
    root.at("name").registerValidator(pipe(later(10, undefined), lookup));
    root.at("name").setValue("a");
    root.at("name").setValue("b");
    await vi.advanceTimersByTimeAsync(10);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith("b", expect.anything());
    expect(messages(["name"])).toEqual(["Taken"]);
  });

  it.each([
    ["a sync check", () => short],
    ["an async check", () => later(10, undefined)],
  ])("skips the wait of a debounced check after %s on validate()", async (_name, first) => {
    const lookup = vi.fn<typeof required>(() => err("Taken"));
    const { root, messages } = make({ name: "abc" }, { timing: "submit" });
    root.at("name").registerValidator(pipe(first(), debounced(lookup, 1000)));
    const valid = root.at("name").validate();
    await vi.advanceTimersByTimeAsync(10);
    expect(await valid).toBe(false);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(messages(["name"])).toEqual(["Taken"]);
  });

  it("puts a schema check's issues through mapError next to plain errors", () => {
    // The fields here are untyped, so the schema takes any value.
    const schema: StandardSchemaV1 = requiredSchema().schema;
    const { root, store } = make(
      { name: "x" },
      { timing: "input", mapError: (raw) => ({ message: `${raw.source}: ${raw.message}` }) },
    );
    root.at("name").registerValidator(pipe(schema, short));
    root.at("name").setValue("");
    expect(store.getSnapshot(["name"]).errors).toEqual([{ message: "schema: Schema required" }]);
    root.at("name").setValue("ab");
    expect(store.getSnapshot(["name"]).errors).toEqual([err("Short")]);
  });

  it("reads as a schema when every check is one", async () => {
    const { schema, validate } = requiredSchema();
    const async: StandardSchemaV1<string, unknown> = {
      "~standard": { version: 1, vendor: "fake", validate: (value) => Promise.resolve(value === "ab" ? { issues: [{ message: "Async" }] } : { value }) },
    };
    const both = pipe(schema, debounced(async, 50));
    expect(both).toHaveProperty("~schema", true);
    const { root, messages } = make({ name: "x" }, { timing: "input" });
    root.at("name").registerValidator(both);
    root.at("name").setValue("");
    expect(messages(["name"])).toEqual(["Schema required"]);
    root.at("name").setValue("ab");
    await vi.advanceTimersByTimeAsync(50);
    expect(messages(["name"])).toEqual(["Async"]);
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("nests, keeping the inner pipe's marks", () => {
    const schema: StandardSchemaV1 = requiredSchema().schema;
    const { root, messages } = make({ name: "x" }, { timing: "input" });
    root.at("name").registerValidator(pipe(pipe(short, schema), pipe(schema, schema), required));
    root.at("name").setValue("");
    expect(messages(["name"])).toEqual(["Short"]);
    root.at("name").setValue("abc");
    expect(messages(["name"])).toEqual([]);
  });

  it("takes its timing from validateOn around it and its recheck from any check", async () => {
    const lookup = vi.fn<typeof required>(() => undefined);
    const { root, messages, validation } = make({ name: "x" }, { timing: "submit" });
    root.at("name").registerValidator(validateOn(pipe(short, recheckOnSubmit(lookup)), "input"));
    root.at("name").setValue("ab");
    expect(messages(["name"])).toEqual(["Short"]);
    root.at("name").setValue("abc");
    expect(lookup).toHaveBeenCalledTimes(1);
    await validation.settleForSubmit();
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("leaves the checks it holds as they were", () => {
    const pipeline = pipe(required, short);
    expect("~flush" in pipeline).toBe(false);
    expect("~on" in required).toBe(false);
    expect(pipeline).not.toHaveProperty("~schema", true);
  });

  it("clears a failing sync step's error at once once it passes and a later async step starts", async () => {
    const lookup = vi.fn<typeof required>((value) => (value === "taken" ? err("Taken") : undefined));
    const { root, messages, validating } = make({ name: "" }, { timing: "input" });
    root.at("name").registerValidator(pipe(short, debounced(lookup, 400)));
    root.at("name").setValue("ab");
    expect(messages(["name"])).toEqual(["Short"]);
    expect(validating(["name"])).toBe(false);
    // Passing step 0 clears "Short" right away while the debounced lookup waits.
    root.at("name").setValue("abcd");
    expect(messages(["name"])).toEqual([]);
    expect(validating(["name"])).toBe(true);
    await vi.advanceTimersByTimeAsync(400);
    expect(messages(["name"])).toEqual([]);
    expect(validating(["name"])).toBe(false);
  });

  it("keeps an async step's error while the same step re-runs on a new value", async () => {
    const lookup = vi.fn<typeof required>((value) => (typeof value === "string" && value.startsWith("ada") ? err("Taken") : undefined));
    const { root, messages, validating } = make({ name: "" }, { timing: "input" });
    root.at("name").registerValidator(pipe(short, debounced(lookup, 400)));
    root.at("name").setValue("ada");
    await vi.advanceTimersByTimeAsync(400);
    expect(messages(["name"])).toEqual(["Taken"]);
    // Typing "adam" passes step 0 again, but step 1 is still re-running, so "Taken" stays until it settles.
    root.at("name").setValue("adam");
    expect(validating(["name"])).toBe(true);
    expect(messages(["name"])).toEqual(["Taken"]);
    await vi.advanceTimersByTimeAsync(400);
    expect(messages(["name"])).toEqual(["Taken"]);
    // Typing "grace" clears "Taken" once step 1 settles.
    root.at("name").setValue("grace");
    expect(messages(["name"])).toEqual(["Taken"]);
    await vi.advanceTimersByTimeAsync(400);
    expect(messages(["name"])).toEqual([]);
  });

  it("clears an async step's error as soon as it passes before a later async step finishes", async () => {
    const { root, messages, validating } = make({ name: "" }, { timing: "input" });
    root.at("name").registerValidator(
      pipe(
        (value: unknown) =>
          new Promise<FormError | undefined>((resolve) => setTimeout(() => resolve(value === "bad" ? err("First") : undefined), 10)),
        later(50, err("Second")),
      ),
    );
    root.at("name").setValue("bad");
    await vi.advanceTimersByTimeAsync(10);
    expect(messages(["name"])).toEqual(["First"]);
    root.at("name").setValue("good");
    // Step 0 is still running, so "First" stays.
    expect(messages(["name"])).toEqual(["First"]);
    await vi.advanceTimersByTimeAsync(10);
    // Step 0 passed and step 1 is now running: "First" is gone.
    expect(messages(["name"])).toEqual([]);
    expect(validating(["name"])).toBe(true);
    await vi.advanceTimersByTimeAsync(50);
    expect(messages(["name"])).toEqual(["Second"]);
    expect(validating(["name"])).toBe(false);
  });

  it("tracks failed steps per field when one pipe is shared and across nested pipes", async () => {
    const shared = pipe(pipe(required, short), debounced(() => undefined, 400));
    const { root, messages } = make({ a: "", b: "" }, { timing: "input" });
    root.at("a").registerValidator(shared);
    root.at("b").registerValidator(shared);
    root.at("a").setValue("ab");
    root.at("b").setValue("cd");
    expect(messages(["a"])).toEqual(["Short"]);
    expect(messages(["b"])).toEqual(["Short"]);
    // Passing on `a` clears `a` immediately without affecting `b`.
    root.at("a").setValue("abcd");
    expect(messages(["a"])).toEqual([]);
    expect(messages(["b"])).toEqual(["Short"]);
  });
});
