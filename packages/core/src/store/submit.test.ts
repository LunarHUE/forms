import { afterEach, describe, expect, it, vi } from "vitest";
import type { SubmitContext } from "../definition.js";
import type { FormError, MapError, ShowMode } from "../errors.js";
import type { Submission } from "../snapshot.js";
import type { StandardSchemaV1 } from "../standard-schema.js";
import type { FormStore } from "../store.js";
import { validation as runner } from "../plugins/validation.js";
import { createFormInternals, type FormStoreOptions } from "./form-store.js";

// Core declares no timer globals, so the tests declare the one they use.
declare function setTimeout(run: () => void, ms: number): unknown;

interface Value {
  name: string;
  rows: { title: string }[];
}

type Intent = "save" | "draft" | undefined;
type Options<R> = Omit<FormStoreOptions<Value, FormError, Intent, R>, "id" | "initial">;

const initial: Value = { name: "ada", rows: [{ title: "a" }, { title: "b" }] };

const make = <R = unknown>(options: Options<R> = {}, value: Value = initial) =>
  createFormInternals<Value, FormError, Intent, R>({ id: "f", initial: value, plugins: [runner()], ...options });

const err = (message: string): FormError => ({ message });
const required = (value: unknown) => (value === "" ? err("Required") : undefined);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Waits until every pending promise callback has run. */
const flush = () => new Promise<void>((resolve) => void setTimeout(resolve, 0));

/** Counts form listener calls, and field listener calls per path. */
function count(store: FormStore<Value, FormError, Intent>, paths: string[][] = []) {
  const runs = { form: 0, fields: paths.map(() => 0) };
  store.subscribeForm(() => void runs.form++);
  for (const [i, path] of paths.entries()) store.subscribe(path, () => void (runs.fields[i] = (runs.fields[i] ?? 0) + 1));
  return runs;
}

const keys = (store: FormStore<Value, FormError, Intent>) => store.getSnapshot(["rows"]).keys ?? [];

describe("submit", () => {
  it("goes submitting with the intent, then succeeded with what onSubmit returned", async () => {
    let seen: { value: unknown; ctx: SubmitContext<Value, FormError, Intent> } | undefined;
    const { store } = make({ onSubmit: (value, ctx) => ((seen = { value, ctx }), "ok") });
    expect(store.getFormSnapshot().submission).toEqual({ status: "idle" });
    const done = store.submit("save");
    expect(store.getFormSnapshot()).toMatchObject({ submitting: true, submission: { status: "submitting", intent: "save" } });
    const submission = await done;
    expect(submission).toEqual({ status: "succeeded", result: "ok" });
    expect(store.getFormSnapshot().submission).toBe(submission);
    expect(store.getFormSnapshot().submitting).toBe(false);
    // Without a schema `value` is the form value, and `input` is that same value.
    expect(seen?.value).toBe(store.getSnapshot([]).value);
    expect(seen?.ctx.input).toBe(seen?.value);
    expect(seen?.ctx.intent).toBe("save");
    expect(seen?.ctx.store).toBe(store);
    expect(seen?.ctx.signal.aborted).toBe(false);
  });

  it("succeeds with an undefined result when there is no onSubmit", async () => {
    const { store } = make();
    expect(await store.submit()).toEqual({ status: "succeeded", result: undefined });
  });

  it("returns the running submit's promise to a second call", async () => {
    const gate = deferred<string>();
    const onSubmit = vi.fn<() => Promise<string>>(() => gate.promise);
    const { store } = make({ onSubmit });
    const first = store.submit("save");
    const second = store.submit("draft");
    expect(second).toBe(first);
    expect(store.getFormSnapshot().submission).toEqual({ status: "submitting", intent: "save" });
    gate.resolve("r");
    await first;
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(store.getFormSnapshot().submitCount).toBe(1);
    // Once it ends, the next call starts a new submit.
    expect(store.submit()).not.toBe(first);
  });

  it("gives each submit a new signal", async () => {
    const signals: unknown[] = [];
    const { store } = make({ onSubmit: (_value, ctx) => void signals.push(ctx.signal) });
    await store.submit();
    await store.submit();
    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
  });

  it("awaits async onSubmit", async () => {
    const gate = deferred<number>();
    const { store } = make({ onSubmit: () => gate.promise });
    const done = store.submit();
    await flush();
    expect(store.getFormSnapshot().submission.status).toBe("submitting");
    gate.resolve(7);
    expect(await done).toEqual({ status: "succeeded", result: 7 });
  });

  it("ends failed with the thrown value untouched, on no field, without mapError", async () => {
    const boom = new Error("boom");
    const mapError = vi.fn<MapError<FormError>>(() => err("mapped"));
    const { store } = make({
      mapError,
      onSubmit: () => {
        throw boom;
      },
    });
    const submission = await store.submit();
    expect(submission).toEqual({ status: "failed", error: boom });
    expect(submission.status === "failed" && submission.error).toBe(boom);
    expect(store.getSnapshot([]).errors).toEqual([]);
    expect(store.getSnapshot(["name"]).errors).toEqual([]);
    expect(store.getFormSnapshot().valid).toBe(true);
    expect(mapError).not.toHaveBeenCalled();
  });

  it("ends failed with a rejected value untouched", async () => {
    const reason = { code: 409 };
    const { store } = make({ onSubmit: () => Promise.reject(reason) });
    const submission = await store.submit();
    expect(submission.status === "failed" && submission.error).toBe(reason);
  });

  it("never rejects, whatever onSubmit throws", async () => {
    const { store } = make({ onSubmit: () => Promise.reject(new Error("x")) });
    await expect(store.submit()).resolves.toMatchObject({ status: "failed" });
    await expect(store.handleSubmit()).resolves.toBeUndefined();
  });
});

describe("validation on submit", () => {
  it("ends invalid without calling onSubmit, and counts the submit", async () => {
    const onSubmit = vi.fn<() => void>();
    const { store } = make({ onSubmit, validate: { fields: { name: required } } }, { ...initial, name: "" });
    const submission = await store.submit();
    expect(submission).toEqual({ status: "invalid" });
    expect(store.getFormSnapshot().submission).toBe(submission);
    expect(store.getFormSnapshot().submitCount).toBe(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(store.getSnapshot(["name"]).errors).toEqual([err("Required")]);
  });

  it("waits for async validators before it decides", async () => {
    const gate = deferred<FormError | undefined>();
    const onSubmit = vi.fn<() => void>();
    const { store } = make({ onSubmit, validate: { fields: { name: () => gate.promise } } });
    const done = store.submit();
    await flush();
    expect(store.getFormSnapshot().validating).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    gate.resolve(err("taken"));
    expect(await done).toEqual({ status: "invalid" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is blocked by a validation error on a disabled field, which firstInvalid skips", async () => {
    const onSubmit = vi.fn<() => void>();
    const { store } = make({ onSubmit, disabled: { name: true }, validate: { fields: { name: required } } }, { ...initial, name: "" });
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(store.firstInvalid()).toBeUndefined();
  });

  it("is not blocked by user errors", async () => {
    const onSubmit = vi.fn<() => void>();
    const { store } = make({ onSubmit });
    store.setErrors({ fields: { name: err("Server says no") } });
    expect(await store.submit()).toMatchObject({ status: "succeeded" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("counts every submit, and the submitted show modes wait for the first", async () => {
    for (const show of ["submitted", "touched-or-submitted"] satisfies ShowMode[]) {
      const { store } = make({ show, validate: { on: "input", fields: { name: required } } });
      store.root.at("name").setValue("");
      expect(store.getSnapshot(["name"]).errors).toEqual([err("Required")]);
      expect(store.getSnapshot(["name"]).shownErrors).toEqual([]);
      await store.submit();
      expect(store.getSnapshot(["name"]).shownErrors).toEqual([err("Required")]);
      store.root.at("name").setValue("ok");
      await store.submit();
      expect(store.getFormSnapshot().submitCount).toBe(2);
    }
  });
});

/** A Standard Schema that trims `name` and counts its runs. Fails on an empty name. */
const trimming = (async = false) => {
  const runs = vi.fn<(input: unknown) => void>();
  const validate = (input: unknown): StandardSchemaV1.Result<{ name: string; titles: string[] }> => {
    runs(input);
    // The schema is only given values of the form's type.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const value = input as Value;
    const name = value.name.trim();
    if (name === "") return { issues: [{ message: "Required", path: ["name"] }] };
    return { value: { name, titles: value.rows.map((row) => row.title) } };
  };
  const schema: StandardSchemaV1<Value, { name: string; titles: string[] }> = {
    "~standard": { version: 1, vendor: "fake", validate: async ? (input) => Promise.resolve(validate(input)) : validate },
  };
  return { schema, runs };
};

describe("schema output", () => {
  for (const async of [false, true])
    it(`passes the output as value and the pre-transform value as input, running the schema once (${async ? "async" : "sync"})`, async () => {
      const { schema, runs } = trimming(async);
      let seen: { value: unknown; input: unknown } | undefined;
      const { store } = make({ schema, onSubmit: (value, ctx) => void (seen = { value, input: ctx.input }) }, { ...initial, name: " ada " });
      expect((await store.submit()).status).toBe("succeeded");
      expect(seen?.value).toEqual({ name: "ada", titles: ["a", "b"] });
      expect(seen?.input).toBe(store.getSnapshot([]).value);
      expect(seen?.input).toEqual({ ...initial, name: " ada " });
      expect(runs).toHaveBeenCalledTimes(1);
    });

  it("uses the output of a schema run that already passed on the current value", async () => {
    const { schema, runs } = trimming();
    const seen: unknown[] = [];
    const { store } = make({ schema, onSubmit: (value) => void seen.push(value) });
    await store.submit();
    // Armed by the first submit, the schema reruns on this edit, and the second submit reuses that run.
    store.root.at("name").setValue(" bob ");
    expect(runs).toHaveBeenCalledTimes(2);
    await store.submit();
    expect(runs).toHaveBeenCalledTimes(2);
    expect(seen[1]).toEqual({ name: "bob", titles: ["a", "b"] });
  });

  it("runs the schema again when a write that was not a user edit changed the value", async () => {
    const { schema, runs } = trimming();
    const seen: unknown[] = [];
    const { store } = make({ schema, onSubmit: (value) => void seen.push(value) });
    await store.submit();
    // Submit armed the schema, so the write reruns it, and the next submit uses that run's output.
    store.root.at("name").setValue(" eve ", { edited: false });
    expect(runs).toHaveBeenCalledTimes(2);
    await store.submit();
    expect(runs).toHaveBeenCalledTimes(2);
    expect(seen[1]).toEqual({ name: "eve", titles: ["a", "b"] });
  });

  it("ends invalid and lands the issues when that rerun fails", async () => {
    const { schema } = trimming();
    const onSubmit = vi.fn<() => void>();
    const { store } = make({ schema, onSubmit });
    await store.submit();
    store.root.at("name").setValue("  ", { edited: false });
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot(["name"]).errors).toEqual([err("Required")]);
  });
});

describe("abort on reset", () => {
  it("aborts the signal, goes idle and drops the late result", async () => {
    const gate = deferred<string>();
    let signal: SubmitContext<Value, FormError, Intent>["signal"] | undefined;
    const { store } = make({
      onSubmit: (_value, ctx) => {
        signal = ctx.signal;
        return gate.promise;
      },
    });
    const done = store.submit("save");
    await vi.waitFor(() => expect(signal).toBeDefined());
    store.reset();
    expect(signal?.aborted).toBe(true);
    const idle = store.getFormSnapshot().submission;
    expect(idle).toEqual({ status: "idle" });
    expect(store.getFormSnapshot().submitting).toBe(false);
    gate.resolve("late");
    expect(await done).toBe(idle);
    expect(store.getFormSnapshot().submission).toBe(idle);
  });

  it("drops a late error too", async () => {
    const gate = deferred<string>();
    const { store } = make({ onSubmit: () => gate.promise });
    const done = store.submit();
    await flush();
    store.reset();
    gate.reject(new Error("late"));
    expect(await done).toEqual({ status: "idle" });
    expect(store.getFormSnapshot().submission).toEqual({ status: "idle" });
  });

  it("lets a new submit start at once, which the old run's late result doesn't touch", async () => {
    const gates = [deferred<string>(), deferred<string>()];
    let call = 0;
    const { store } = make({ onSubmit: () => gates[call++]?.promise ?? "" });
    const first = store.submit();
    await flush();
    store.reset();
    const second = store.submit("draft");
    expect(second).not.toBe(first);
    expect(store.getFormSnapshot().submission).toEqual({ status: "submitting", intent: "draft" });
    await flush();
    gates[0]?.resolve("old");
    expect(await first).toEqual({ status: "idle" });
    expect(store.getFormSnapshot().submission).toEqual({ status: "submitting", intent: "draft" });
    gates[1]?.resolve("new");
    expect(await second).toEqual({ status: "succeeded", result: "new" });
    expect(call).toBe(2);
  });

  it("never calls onSubmit when the reset comes while the schema runs again for submit", async () => {
    const gates: ReturnType<typeof deferred<StandardSchemaV1.Result<Value>>>[] = [];
    const schema: StandardSchemaV1<Value> = {
      "~standard": {
        version: 1,
        vendor: "fake",
        validate: () => {
          const gate = deferred<StandardSchemaV1.Result<Value>>();
          gates.push(gate);
          return gate.promise;
        },
      },
    };
    const onSubmit = vi.fn<() => void>();
    const { store } = make({ schema, onSubmit });
    const first = store.submit();
    gates[0]?.resolve({ value: initial });
    await first;
    // A load that is not a user edit leaves the schema's last output stale.
    store.root.at("name").setValue("loaded", { edited: false });
    const done = store.submit();
    await vi.waitFor(() => expect(gates).toHaveLength(2));
    store.reset();
    gates[1]?.resolve({ value: initial });
    expect(await done).toEqual({ status: "idle" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("never calls onSubmit when the reset comes while validators run", async () => {
    const gate = deferred<undefined>();
    const onSubmit = vi.fn<() => void>();
    const { store } = make({ onSubmit, validate: { fields: { name: () => gate.promise } } });
    const done = store.submit();
    store.reset();
    gate.resolve(undefined);
    expect(await done).toEqual({ status: "idle" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("puts a settled submission back to idle, and resets an idle form without waking the form", async () => {
    const { store } = make({ onSubmit: () => "ok" });
    store.getFormSnapshot();
    const runs = count(store);
    store.reset();
    expect(runs.form).toBe(0);
    await store.submit();
    store.reset();
    expect(store.getFormSnapshot().submission).toEqual({ status: "idle" });
    // The count stays: it counts every submit the form instance started.
    expect(store.getFormSnapshot().submitCount).toBe(1);
  });

  it("leaves a running submit alone on a field reset", async () => {
    const gate = deferred<string>();
    let signal: SubmitContext<Value, FormError, Intent>["signal"] | undefined;
    const { store } = make({
      onSubmit: (_value, ctx) => {
        signal = ctx.signal;
        return gate.promise;
      },
    });
    const done = store.submit();
    await vi.waitFor(() => expect(signal).toBeDefined());
    store.root.at("name").reset();
    expect(signal?.aborted).toBe(false);
    gate.resolve("ok");
    expect(await done).toEqual({ status: "succeeded", result: "ok" });
  });
});

describe("submit after a field reset", () => {
  // Both validators sit above the reset field, so they already ran, and the reset clears their errors on it.
  const above: Options<unknown>[] = [
    { validate: { form: (value) => (value.name === "" ? { fields: { name: err("Required") } } : undefined) } },
    { validate: { fields: { rows: (rows) => (rows.some((row) => row.title === "") ? err("Untitled") : undefined) } } },
  ];

  it.each(above)("runs the validators above the field again when its baseline is invalid (%#)", async (options) => {
    const onSubmit = vi.fn<() => void>();
    const { store } = make({ ...options, onSubmit }, { name: "", rows: [{ title: "" }] });
    store.root.at("name").setValue("ada");
    store.root.at("rows").item("k0").at("title").setValue("a");
    expect(await store.submit()).toEqual({ status: "succeeded", result: undefined });
    store.root.at("name").reset();
    store.root.at("rows").item("k0").at("title").reset();
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const path = options.validate?.form ? ["name"] : ["rows"];
    expect(store.getSnapshot(path).shownErrors).toHaveLength(1);
  });
});

describe("handleSubmit", () => {
  it("prevents the default and submits with an undefined intent", async () => {
    const intents: unknown[] = [];
    const { store } = make({ onSubmit: (_value, ctx) => void intents.push(ctx.intent) });
    const preventDefault = vi.fn<() => void>();
    await expect(store.handleSubmit({ preventDefault })).resolves.toBeUndefined();
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(store.getFormSnapshot().submission.status).toBe("succeeded");
    await store.handleSubmit();
    expect(intents).toEqual([undefined, undefined]);
    expect(store.getFormSnapshot().submitCount).toBe(2);
  });
});

describe("user errors and submit", () => {
  it("clears every user error when a submit starts", () => {
    const { store } = make();
    store.setErrors({ form: err("form"), fields: { name: err("name") } });
    store.root.at("rows").item(keys(store)[0] ?? "").at("title").setErrors(err("title"));
    void store.submit();
    expect(store.getSnapshot([]).errors).toEqual([]);
    expect(store.getSnapshot(["name"]).errors).toEqual([]);
    expect(store.getSnapshot(["rows", keys(store)[0] ?? "", "title"]).errors).toEqual([]);
  });

  it("keeps errors set inside onSubmit, as user errors, without changing the status", async () => {
    const { store } = make({
      onSubmit: (_value, ctx) => {
        ctx.store.setErrors({ fields: { name: err("Taken") } });
        return "saved";
      },
    });
    expect(await store.submit()).toEqual({ status: "succeeded", result: "saved" });
    expect(store.getSnapshot(["name"]).errors).toEqual([err("Taken")]);
    expect(store.getSnapshot(["name"]).invalid).toBe(false);
    expect(store.getFormSnapshot().valid).toBe(true);
  });

  it("keeps errors set from a failed onSubmit, beside the failure", async () => {
    const boom = new Error("conflict");
    const { store } = make({
      onSubmit: (_value, ctx) => {
        ctx.store.setErrors({ form: err("Try again") });
        throw boom;
      },
    });
    expect(await store.submit()).toEqual({ status: "failed", error: boom });
    expect(store.getSnapshot([]).errors).toEqual([err("Try again")]);
  });
});

describe("firstInvalid", () => {
  const options: Options<unknown> = { validate: { fields: { name: required, rows: [{ title: required }] } } };

  it("is the first enabled field with a validation error after an invalid submit, in value order", async () => {
    const { store } = make(options, { name: "ok", rows: [{ title: "" }, { title: "" }] });
    const [a, b] = keys(store);
    expect(store.firstInvalid()).toBeUndefined();
    await store.submit();
    expect(store.firstInvalid()).toBe(store.root.at("rows").item(a ?? "").at("title"));
    // Moving the second row first makes it first in value order.
    store.root.at("rows").move(1, 0);
    expect(store.firstInvalid()).toBe(store.root.at("rows").item(b ?? "").at("title"));
  });

  it("skips disabled fields and fields with only user errors", async () => {
    const { store } = make(options, { name: "", rows: [{ title: "" }, { title: "" }] });
    const [a, b] = keys(store);
    await store.submit();
    store.root.at("name").setDisabled(true);
    store.root.at("rows").item(a ?? "").setDisabled(true);
    store.setErrors({ fields: { name: err("user") } });
    expect(store.firstInvalid()).toBe(store.root.at("rows").item(b ?? "").at("title"));
    store.root.at("rows").item(b ?? "").at("title").setValue("ok");
    expect(store.firstInvalid()).toBeUndefined();
  });
});

const title = (store: FormStore<Value, FormError, Intent>, i: number) => store.root.at("rows").item(keys(store)[i] ?? "").at("title");

describe("disabledInvalid", () => {
  const options: Options<unknown> = { validate: { fields: { name: required, rows: [{ title: required }] } } };

  it("lists the only invalid fields when they are disabled, with errors the show setting hides", async () => {
    const onSubmit = vi.fn<() => void>();
    const { store } = make(
      { ...options, onSubmit, show: "touched", disabled: { name: true } },
      { name: "", rows: [{ title: "a" }, { title: "b" }] },
    );
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(store.firstInvalid()).toBeUndefined();
    // The field was never touched, so `show: "touched"` hides its error from the snapshot.
    expect(store.getSnapshot(["name"]).shownErrors).toEqual([]);
    expect(store.disabledInvalid()).toEqual([{ field: store.root.at("name"), name: "name", errors: [err("Required")] }]);
    expect(store.disabledInvalid()[0]?.field).toBe(store.root.at("name"));
  });

  it("lists only the disabled ones when enabled fields are invalid too", async () => {
    const { store } = make(options, { name: "", rows: [{ title: "" }, { title: "b" }] });
    title(store, 0).setDisabled(true);
    await store.submit();
    expect(store.firstInvalid()).toBe(store.root.at("name"));
    expect(store.disabledInvalid()).toEqual([{ field: title(store, 0), name: "rows.0.title", errors: [err("Required")] }]);
  });

  it("lists the fields of a disabled array row, by their current name", async () => {
    const { store } = make(options, { name: "ok", rows: [{ title: "" }, { title: "" }] });
    const second = title(store, 1);
    store.root.at("rows").item(keys(store)[1] ?? "").setDisabled(true);
    await store.submit();
    expect(store.firstInvalid()).toBe(title(store, 0));
    expect(store.disabledInvalid()).toEqual([{ field: second, name: "rows.1.title", errors: [err("Required")] }]);
    store.root.at("rows").move(1, 0);
    expect(store.disabledInvalid()).toEqual([{ field: second, name: "rows.0.title", errors: [err("Required")] }]);
  });

  it("lists the invalid children of a disabled parent, in value order, and not the parent", async () => {
    const { store } = make({ ...options, disabled: { rows: true } }, { name: "ok", rows: [{ title: "" }, { title: "" }] });
    await store.submit();
    expect(store.firstInvalid()).toBeUndefined();
    expect(store.disabledInvalid().map((entry) => entry.name)).toEqual(["rows.0.title", "rows.1.title"]);
    expect(store.disabledInvalid().map((entry) => entry.field)).toEqual([title(store, 0), title(store, 1)]);
  });

  it("drops a field enabled again after the failed submit, which firstInvalid then finds", async () => {
    const { store } = make({ ...options, disabled: { name: true } }, { name: "", rows: [{ title: "a" }] });
    await store.submit();
    expect(store.disabledInvalid()).toHaveLength(1);
    store.root.at("name").setDisabled(false);
    expect(store.disabledInvalid()).toEqual([]);
    expect(store.firstInvalid()).toBe(store.root.at("name"));
  });

  it("lists a whole-form schema issue that sits on a disabled field", async () => {
    const schema: StandardSchemaV1<Value> = {
      "~standard": { version: 1, vendor: "fake", validate: () => ({ issues: [{ message: "Bad name", path: ["name"] }] }) },
    };
    const onSubmit = vi.fn<() => void>();
    const { store } = make({ schema, onSubmit, disabled: { name: true } });
    expect(await store.submit()).toEqual({ status: "invalid" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(store.firstInvalid()).toBeUndefined();
    expect(store.disabledInvalid()).toEqual([{ field: store.root.at("name"), name: "name", errors: [err("Bad name")] }]);
  });

  it("leaves read-only fields to firstInvalid", async () => {
    const { store } = make({ ...options, readOnly: { name: true } }, { name: "", rows: [] });
    await store.submit();
    expect(store.firstInvalid()).toBe(store.root.at("name"));
    expect(store.disabledInvalid()).toEqual([]);
  });

  it("is empty for a form without disabled invalid fields, and reading it changes nothing", async () => {
    const { store, core } = make(options, { name: "", rows: [{ title: "" }] });
    await store.submit();
    const form = store.getFormSnapshot();
    const name = store.getSnapshot(["name"]);
    const nodes = core.stats().nodes;
    const runs = count(store, [["name"], []]);
    expect(store.disabledInvalid()).toEqual([]);
    expect(runs).toEqual({ form: 0, fields: [0, 0] });
    expect(store.getFormSnapshot()).toBe(form);
    expect(store.getSnapshot(["name"])).toBe(name);
    expect(core.stats().nodes).toBe(nodes);
  });
});

describe("store rules", () => {
  it("wakes each subscription once per phase", async () => {
    const gate = deferred<string>();
    const { store } = make({ onSubmit: () => gate.promise, validate: { fields: { name: required } } });
    store.setErrors({ fields: { name: err("user"), "rows.0.title": err("user") } });
    store.getFormSnapshot();
    const runs = count(store, [["name"], ["rows", keys(store)[0] ?? "", "title"], ["rows"]]);
    const done = store.submit();
    // The start: user errors cleared, the count, the status and sync validators, in one batch.
    expect(runs).toEqual({ form: 1, fields: [1, 1, 0] });
    await flush();
    expect(runs).toEqual({ form: 1, fields: [1, 1, 0] });
    gate.resolve("ok");
    await done;
    expect(runs).toEqual({ form: 2, fields: [1, 1, 0] });
  });

  it("updates the snapshot before listeners run", async () => {
    const { store } = make({ onSubmit: () => "ok" });
    const seen: Submission<Intent>["status"][] = [];
    store.subscribeForm(() => void seen.push(store.getFormSnapshot().submission.status));
    await store.submit();
    expect(seen).toEqual(["submitting", "succeeded"]);
  });

  it("does nothing at creation", () => {
    vi.useFakeTimers();
    try {
      const onSubmit = vi.fn<() => void>();
      const validate = vi.fn<() => StandardSchemaV1.Result<Value>>(() => ({ value: initial }));
      const { core } = make({ onSubmit, schema: { "~standard": { version: 1, vendor: "fake", validate } } });
      expect(onSubmit).not.toHaveBeenCalled();
      expect(validate).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
      expect(core.stats().nodes).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

/** Replaces `console.warn` with a mock and returns it. */
const spy = () => {
  const warn = vi.fn<(message: string) => void>();
  vi.stubGlobal("console", { warn });
  return warn;
};

describe("submit:unseen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // Like a schema library's: a missing value fails at the root, an empty
  // name at `name`, and no rows at `rows`.
  const schema: StandardSchemaV1<Value> = {
    "~standard": {
      version: 1,
      vendor: "fake",
      validate(input) {
        if (typeof input !== "object" || input === null) return { issues: [{ message: "Invalid type: Expected Object but received undefined" }] };
        // The test only passes values of the form's own type.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const value = input as Value;
        const issues = [
          ...(value.name === "" ? [{ message: "Required", path: ["name"] }] : []),
          ...(value.rows.length === 0 ? [{ message: "Add a row", path: ["rows"] }] : []),
        ];
        return issues.length > 0 ? { issues } : { value };
      },
    },
  };

  /** A store whose inputs are mounted: something subscribes to each of `paths`. */
  const mounted = (paths: string[][], value: Value = initial) => {
    const { store } = make({ schema }, value);
    for (const path of paths) store.subscribe(path, () => {});
    return store;
  };

  const clear = (store: FormStore<Value, FormError, Intent>) =>
    // The schema's root error needs a value the type doesn't allow.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    store.root.setValue(undefined as unknown as Value, { replace: true });

  it("warns when the only error is on the root and nothing reads it", async () => {
    const warn = spy();
    const store = mounted([["name"], ["rows"]]);
    clear(store);
    expect((await store.submit()).status).toBe("invalid");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/^@lunarhue\/forms-core: A submit failed on errors at the root, and nothing on the page reads them, .+#core:submit:unseen$/),
    );
  });

  it("names an object or array field whose errors nothing reads", async () => {
    const warn = spy();
    // `rows.0.title` has an input, so `rows` has fields under it.
    const store = mounted([["name"], ["rows", "0", "title"]], { ...initial, rows: [] });
    await store.submit();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("errors at `rows`,"));
  });

  it("stays quiet when the form reads its root errors", async () => {
    const warn = spy();
    const store = mounted([["name"], []]);
    clear(store);
    await store.submit();
    expect(warn).not.toHaveBeenCalled();
  });

  it("stays quiet when a field's errors are read", async () => {
    const warn = spy();
    const store = mounted([["name"]], { ...initial, name: "" });
    expect((await store.submit()).status).toBe("invalid");
    expect(warn).not.toHaveBeenCalled();
  });

  it("stays quiet about a field with no input", async () => {
    const warn = spy();
    // Nothing subscribes to `name`. A wizard may show its step after the submit.
    const store = mounted([], { ...initial, name: "" });
    await store.submit();
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns once per store", async () => {
    const warn = spy();
    const store = mounted([]);
    clear(store);
    await store.submit();
    await store.submit();
    expect(warn).toHaveBeenCalledOnce();
    const other = mounted([]);
    clear(other);
    await other.submit();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("stays quiet in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = spy();
    const store = mounted([]);
    clear(store);
    expect((await store.submit()).status).toBe("invalid");
    expect(warn).not.toHaveBeenCalled();
  });
});
