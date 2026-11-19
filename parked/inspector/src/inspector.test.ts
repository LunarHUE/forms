import { type AnyFormStore, createFormsCore, type Path } from "@lunarhue/forms-core";
import { arrays, dirty } from "@lunarhue/forms-core/plugins";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServerSettings, mountInspector } from "./index.js";

// A form with nested objects and an array, enough to give the table every
// kind of row.
const Address = v.object({ street: v.string(), city: v.string(), country: v.string() });

const Order = v.object({
  customer: v.object({ name: v.string(), email: v.string() }),
  delivery: v.string(),
  lineItems: v.array(v.object({ description: v.string(), quantity: v.number(), unitPrice: v.number() })),
  billing: Address,
  shipping: Address,
});

const london = { street: "12 St James's Square", city: "London", country: "GB" };

const definition = createFormsCore({ plugins: [valibot(), arrays(), dirty()] }).define({
  schema: Order,
  defaultValues: {
    customer: { name: "Ada Lovelace", email: "ada@example.com" },
    delivery: "standard",
    lineItems: [
      { description: "Analytical engine manual", quantity: 1, unitPrice: 94 },
      { description: "Punched cards", quantity: 3, unitPrice: 7.5 },
    ],
    billing: london,
    shipping: london,
  },
  onSubmit: () => "saved",
});

/** A value the "fill with invalid data" button writes. */
const invalidOrder = {
  customer: { name: "", email: "taken@example.com" },
  delivery: "standard",
  lineItems: [{ description: "", quantity: 0, unitPrice: 1 }],
  billing: london,
  shipping: london,
};

/** Wraps a store so the test can count the subscriptions that are still open. */
function counted<S extends AnyFormStore<unknown>>(store: S) {
  let open = 0;
  const track = (off: () => void) => {
    open++;
    let closed = false;
    return () => {
      if (!closed) open--;
      closed = true;
      off();
    };
  };
  const wrapped: S = {
    ...store,
    subscribe: (path, listener) => track(store.subscribe(path, listener)),
    subscribeForm: (listener) => track(store.subscribeForm(listener)),
  };
  return { store: wrapped, open: () => open };
}

let target: HTMLElement;

beforeEach(() => {
  target = document.createElement("div");
  document.body.append(target);
});

afterEach(() => {
  target.remove();
});

const rowAt = (path: Path) =>
  Array.from(target.querySelectorAll<HTMLTableRowElement>("tbody tr")).find((row) => row.dataset["path"] === JSON.stringify(path));

const cellAt = (path: Path, column: string) => rowAt(path)?.querySelector<HTMLElement>(`td[data-column="${column}"]`);

const logLines = () => Array.from(target.querySelectorAll(".inspector-log li"), (line) => line.textContent);

const buttonNamed = (label: string) => {
  const found = Array.from(target.querySelectorAll("button")).find((button) => button.textContent === label);
  if (!found) throw new Error(`No button "${label}"`);
  return found;
};

describe("mountInspector", () => {
  it("shows a row for every field, nested and in arrays, in value order", () => {
    const store = definition.createStore();
    mountInspector(target, store);
    const [first, second] = store.root.at("lineItems").peek().keys;
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    expect(cellAt([], "name")?.textContent).toBe("(root)");
    expect(cellAt(["customer", "name"], "name")?.textContent).toBe("customer.name");
    expect(cellAt(["customer", "name"], "value")?.textContent).toBe('"Ada Lovelace"');
    expect(cellAt(["lineItems", second ?? "", "unitPrice"], "name")?.textContent).toBe("lineItems.1.unitPrice");
    expect(cellAt(["lineItems", second ?? "", "unitPrice"], "value")?.textContent).toBe("7.5");
    expect(cellAt(["billing", "country"], "value")?.textContent).toBe('"GB"');

    const names = Array.from(target.querySelectorAll('tbody td[data-column="name"]'), (cell) => cell.textContent);
    expect(names.slice(0, 5)).toEqual(["(root)", "customer", "customer.name", "customer.email", "delivery"]);
    expect(names.indexOf("lineItems.0.description")).toBeLessThan(names.indexOf("lineItems.1.description"));
  });

  it("patches the written field's cells and logs each change", () => {
    const store = definition.createStore();
    mountInspector(target, store);
    const city = store.root.at("shipping").at("city");
    const untouchedRow = rowAt(["customer", "name"]);

    city.setValue("Leeds");
    expect(cellAt(["shipping", "city"], "value")?.textContent).toBe('"Leeds"');
    expect(cellAt(["shipping", "city"], "value")?.classList.contains("flash")).toBe(true);
    expect(cellAt(["shipping", "city"], "dirty")?.textContent).toBe("true");
    expect(logLines()).toContain('shipping.cityvalue"London" → "Leeds"');

    city.handleBlur();
    expect(cellAt(["shipping", "city"], "touched")?.textContent).toBe("true");
    expect(logLines()[0]).toBe("shipping.citytouchedfalse → true");
    // Other rows stay the same elements.
    expect(rowAt(["customer", "name"])).toBe(untouchedRow);
  });

  it("adds rows for a new item and removes the rows of a removed one", () => {
    const store = definition.createStore();
    mountInspector(target, store);
    const items = store.root.at("lineItems");
    const [first, second] = store.root.at("lineItems").peek().keys;

    items.remove(0);
    expect(rowAt(["lineItems", first ?? ""])).toBeUndefined();
    expect(rowAt(["lineItems", first ?? "", "description"])).toBeUndefined();
    expect(cellAt(["lineItems", second ?? "", "description"], "name")?.textContent).toBe("lineItems.0.description");
    expect(logLines()).toContain("lineItemskeys[2 items] → [1 item]");

    items.push({ description: "Lamp", quantity: 1, unitPrice: 20 });
    const added = items.peek().keys[1];
    expect(cellAt(["lineItems", added ?? "", "description"], "value")?.textContent).toBe('"Lamp"');
    expect(target.querySelectorAll('tbody tr[data-path^="[\\"lineItems\\","]')).toHaveLength(8);
  });

  it("logs submits and refreshes the changes list", async () => {
    const store = definition.createStore();
    mountInspector(target, store);
    store.root.at("customer").at("name").setValue("Grace Hopper");
    await Promise.resolve();
    expect(target.querySelector(".inspector-list")?.textContent).toBe('customer.name: "Ada Lovelace" → "Grace Hopper"');

    await store.handleSubmit();
    expect(logLines()).toContain("formsubmitstarted");
    expect(logLines().some((line) => line?.startsWith("formsubmitended succeeded"))).toBe(true);
    expect(target.querySelector('dd[data-member="submitCount"]')?.textContent).toBe("1");
  });

  it("writes to the store only from its controls", () => {
    const store = definition.createStore();
    const settings = createServerSettings();
    mountInspector(target, store, { settings, invalidValue: invalidOrder });

    buttonNamed("Fill with invalid data").click();
    expect(cellAt(["customer", "name"], "value")?.textContent).toBe('""');

    const select = target.querySelector<HTMLSelectElement>(".inspector-flags select");
    if (!select) throw new Error("No field select");
    select.value = JSON.stringify(["billing"]);
    buttonNamed("Toggle disabled").click();
    expect(cellAt(["billing", "street"], "disabled")?.textContent).toBe("true");

    const reject = Array.from(target.querySelectorAll<HTMLLabelElement>(".inspector-toggle")).find((label) =>
      label.textContent.includes("rejects"),
    );
    reject?.querySelector("input")?.click();
    expect(settings.get().reject).toBe(true);
  });

  it("removes its DOM and every subscription on unmount", () => {
    const { store, open } = counted(definition.createStore());
    const unmount = mountInspector(target, store);
    expect(open()).toBeGreaterThan(20);

    store.root.at("lineItems").remove(0);
    unmount();
    expect(open()).toBe(0);
    expect(target.childElementCount).toBe(0);

    const html = target.innerHTML;
    store.root.at("customer").at("name").setValue("Someone else");
    expect(target.innerHTML).toBe(html);
  });
});
