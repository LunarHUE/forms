import { hydrate } from "@solidjs/web";
import { flush } from "solid-js";
import { expect, it, vi } from "vitest";
import { App, DeliveryApp, deliveryHtml, PhoneApp, phoneHtml, serverHtml, ShippingApp, shippingHtml } from "./ssr-app.js";

/** Installs the `_$HY` global that `generateHydrationScript()` puts in a server page. */
function installHydrationGlobal(): void {
  Object.assign(globalThis, { _$HY: { events: [], completed: new WeakSet(), r: {}, fe() {} } });
}

it("hydrates the server markup, keeps its nodes and ids, and then updates", async () => {
  const host = document.createElement("div");
  host.innerHTML = serverHtml;
  document.body.append(host);
  const serverInputs = [...host.querySelectorAll("input")];
  installHydrationGlobal();
  // Solid reports a hydration key miss or an unclaimed server node on the console.
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");

  const dispose = hydrate(() => <App />, host);
  flush();
  expect([...warn.mock.calls, ...error.mock.calls]).toEqual([]);

  const inputs = [...host.querySelectorAll("input")];
  expect(inputs).toEqual(serverInputs);
  inputs.forEach((input, index) => expect(input).toBe(serverInputs[index]));
  expect(inputs.map((input) => input.id)).toEqual(["0--customer", "0--rows--k0--title", "0--rows--k1--title"]);

  const [customer] = inputs;
  if (!customer) throw new Error("No customer input.");
  customer.value = "Grace";
  customer.dispatchEvent(new Event("input", { bubbles: true }));
  host.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  flush();
  expect(host.querySelector("output")?.textContent).toBe("succeeded");
  expect(customer.value).toBe("Grace");
  dispose();
});

it("shows the form's value in an input the browser filled back in before hydration", () => {
  const host = document.createElement("div");
  host.innerHTML = serverHtml;
  document.body.append(host);
  const [customer] = host.querySelectorAll("input");
  if (!customer) throw new Error("No customer input.");
  // Firefox restores typed text on a reload, so the input can differ from its markup.
  customer.value = "typed before the reload";
  installHydrationGlobal();

  const dispose = hydrate(() => <App />, host);
  flush();
  expect(customer.value).toBe("Ada");
  dispose();
  host.remove();
});

it("hydrates what rules set without flipping it", () => {
  const host = document.createElement("div");
  host.innerHTML = shippingHtml;
  document.body.append(host);
  const street = host.querySelector<HTMLInputElement>("[aria-label=street]");
  installHydrationGlobal();
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");

  const dispose = hydrate(() => <ShippingApp />, host);
  flush();
  expect([...warn.mock.calls, ...error.mock.calls]).toEqual([]);
  expect(host.querySelector("[aria-label=street]")).toBe(street);
  expect(street?.disabled).toBe(true);
  expect(host.querySelector("[aria-label=note]")).toBeNull();
  dispose();
  host.remove();
});

it("hydrates a field disabled through its parent when the store changed before the field was read", () => {
  const host = document.createElement("div");
  host.innerHTML = deliveryHtml;
  document.body.append(host);
  const street = host.querySelector<HTMLInputElement>("[aria-label=street]");
  installHydrationGlobal();
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");

  const dispose = hydrate(() => <DeliveryApp />, host);
  expect(street?.disabled).toBe(true);
  flush();
  expect([...warn.mock.calls, ...error.mock.calls]).toEqual([]);
  expect(host.querySelector("[aria-label=street]")).toBe(street);
  expect(street?.disabled).toBe(true);
  dispose();
  host.remove();
});

it("hydrates what field types and fieldsets attached, and keeps showing it", () => {
  const host = document.createElement("div");
  host.innerHTML = phoneHtml;
  document.body.append(host);
  const input = host.querySelector("input");
  installHydrationGlobal();
  const warn = vi.spyOn(console, "warn");
  const error = vi.spyOn(console, "error");

  const dispose = hydrate(() => <PhoneApp />, host);
  flush();
  expect([...warn.mock.calls, ...error.mock.calls]).toEqual([]);
  expect(host.querySelector("input")).toBe(input);
  expect(input?.value).toBe("(555) 123-4");
  expect(host.querySelector<HTMLInputElement>("[aria-label=fax]")?.value).toBe("(555) 9");
  expect(host.querySelector("[aria-label=street]")).toBeNull();
  dispose();
});
