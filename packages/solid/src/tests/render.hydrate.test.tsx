import { hydrate } from "@solidjs/web";
import { flush } from "solid-js";
import { expect, it, vi } from "vitest";
import { App, serverHtml } from "./ssr-app.js";

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
