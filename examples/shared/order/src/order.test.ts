import { createFormsCore } from "@lunarhue/forms-core";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { afterEach, describe, expect, it } from "vitest";
import {
  bumpBadge,
  checkEmail,
  createServerSettings,
  discountErrors,
  invalidOrder,
  loadOrder,
  orderOnSubmit,
  OrderSchema,
  orderTotal,
  orderValidate,
  saveOrder,
  serverSettings,
  submitOrder,
  takenEmail,
} from "./index.js";

const forms = createFormsCore({ schemas: [valibot()] });
const definition = forms.define({
  schema: OrderSchema,
  defaultValues: loadOrder(),
  validate: orderValidate,
  onSubmit: orderOnSubmit,
});

afterEach(() => {
  serverSettings.set({ delayMs: 300, reject: false });
});

describe("schema", () => {
  it("accepts the loaded order", () => {
    expect(v.safeParse(OrderSchema, loadOrder()).success).toBe(true);
  });

  it("rejects the invalid order on several fields", () => {
    const result = v.safeParse(OrderSchema, invalidOrder);
    expect(result.success).toBe(false);
    const names = new Set(result.issues?.map((issue) => v.getDotPath(issue)));
    expect(names).toEqual(
      new Set([
        "customer.name",
        "delivery",
        "lineItems.0.description",
        "lineItems.0.quantity",
        "lineItems.1.quantity",
        "lineItems.1.unitPrice",
        "shipping.city",
        "shipping.country",
      ]),
    );
  });
});

describe("discount rule", () => {
  it("totals the line items", () => {
    expect(orderTotal(loadOrder())).toBe(64.5);
    expect(orderTotal({ lineItems: [{ description: "", quantity: undefined, unitPrice: 3 }] })).toBe(0);
  });

  it("puts an error on discount only when it exceeds the total", () => {
    expect(discountErrors(loadOrder())).toBeUndefined();
    expect(discountErrors({ ...loadOrder(), discount: 64.5 })).toBeUndefined();
    expect(discountErrors({ ...loadOrder(), discount: 65 })?.fields?.["discount"]).toEqual({
      message: "The discount can't exceed the order total of 64.50.",
    });
  });

  it("runs as the definition's form validator", async () => {
    serverSettings.set({ delayMs: 0 });
    const store = definition.createStore();
    store.root.at("discount").setValue(100);
    expect(await store.validate()).toBe(false);
    expect(store.getSnapshot(["discount"]).errors).toEqual([
      { message: "The discount can't exceed the order total of 64.50." },
    ]);
  });

  it("runs the email check as a field validator", async () => {
    serverSettings.set({ delayMs: 0 });
    const store = definition.createStore();
    store.root.at("customer").at("email").setValue(takenEmail);
    expect(await store.validate()).toBe(false);
    expect(store.getSnapshot(["customer", "email"]).errors).toEqual([
      { message: "That email address already has an account." },
    ]);
  });
});

describe("fake server", () => {
  it("reports only the taken address as taken", async () => {
    expect(await checkEmail("ada@example.com", { delayMs: 0 })).toEqual({ available: true });
    expect(await checkEmail(" Taken@Example.com ", { delayMs: 0 })).toEqual({ available: false });
  });

  it("rejects the email check when its signal aborts", async () => {
    const controller = new AbortController();
    const check = checkEmail("ada@example.com", { delayMs: 10_000, signal: controller.signal });
    controller.abort(new Error("stale"));
    await expect(check).rejects.toThrow("stale");
  });

  it("saves a valid order", async () => {
    const result = await saveOrder(loadOrder(), { delayMs: 0 });
    expect(result).toEqual({ ok: true, id: expect.stringMatching(/^ORD-\d+$/) });
  });

  it("returns schema errors by dotted name for an invalid order", async () => {
    const result = await saveOrder(invalidOrder, { delayMs: 0 });
    expect(result).toMatchObject({
      ok: false,
      errors: { fields: { "lineItems.1.unitPrice": [{ message: "The price can't be negative." }] } },
    });
  });

  it("returns a field error and a form error when told to reject", async () => {
    const result = await saveOrder(loadOrder(), { delayMs: 0, reject: true });
    expect(result).toEqual({
      ok: false,
      errors: {
        form: { message: "The server refused the order. Try again." },
        fields: { "customer.email": { message: "This customer's account is on hold." } },
      },
    });
  });

  it("rejects only the next save made through the settings", async () => {
    const settings = createServerSettings({ delayMs: 0, reject: true });
    expect((await submitOrder(loadOrder(), { settings })).ok).toBe(false);
    expect(settings.get().reject).toBe(false);
    expect((await submitOrder(loadOrder(), { settings })).ok).toBe(true);
  });

  it("sends the order and plain settings to a custom save", async () => {
    const settings = createServerSettings({ delayMs: 7, reject: true });
    const calls: unknown[] = [];
    const result = await submitOrder(loadOrder(), {
      settings,
      save: async (order, request) => {
        calls.push(request);
        return saveOrder(order, { ...request, delayMs: 0 });
      },
    });
    expect(calls).toEqual([{ delayMs: 7, reject: true }]);
    expect(result.ok).toBe(false);
    expect(settings.get().reject).toBe(false);
  });

  it("puts a refused save's errors on the form", async () => {
    serverSettings.set({ delayMs: 0, reject: true });
    const store = definition.createStore();
    const submission = await store.submit();
    expect(submission.status).toBe("succeeded");
    expect(store.getSnapshot(["customer", "email"]).errors).toEqual([{ message: "This customer's account is on hold." }]);
    expect(store.getSnapshot([]).errors).toEqual([{ message: "The server refused the order. Try again." }]);
  });
});

describe("server settings", () => {
  it("notifies on change only", () => {
    const settings = createServerSettings();
    let calls = 0;
    const off = settings.subscribe(() => calls++);
    settings.set({ reject: false });
    settings.set({ reject: true });
    off();
    settings.set({ reject: false });
    expect(calls).toBe(1);
  });
});

describe("bumpBadge", () => {
  it("counts up and restarts the flash", () => {
    const badge = document.createElement("span");
    badge.textContent = "0";
    bumpBadge(badge);
    bumpBadge(badge);
    expect(badge.textContent).toBe("2");
    expect(badge.classList.contains("flash")).toBe(true);
  });
});
