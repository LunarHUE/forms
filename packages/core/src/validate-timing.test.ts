import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FormError } from "./errors.js";
import type { StandardSchemaV1 } from "./standard-schema.js";
import { createFormInternals, type FormStoreOptions } from "./store/form-store.js";
import { debounced, recheckOnSubmit, validateOn } from "./validate-timing.js";

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

/** A schema that fails on an empty string, counting its calls. */
const requiredSchema = () => {
  const validate = vi.fn<(value: unknown) => StandardSchemaV1.Result<unknown>>((value) =>
    value === "" ? { issues: [{ message: "Schema required" }] } : { value },
  );
  const schema: StandardSchemaV1<string, unknown> = { "~standard": { version: 1, vendor: "fake", validate } };
  return { schema, validate };
};

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
    const { root, messages } = make({ a: "x" }, { timing: "submit", validate: { form: validateOn(form, "input") } });
    root.at("a").setValue("");
    expect(messages(["a"])).toEqual(["A"]);
  });
});
