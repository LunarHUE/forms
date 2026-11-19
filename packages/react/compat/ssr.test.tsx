import { fireEvent } from "@testing-library/dom";
import { useEffect } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FieldApi } from "../src/index.js";
import { act, hydrate, modern } from "./render.js";

type Adapter = typeof import("../src/index.js") & typeof import("../src/plugins.js");

/**
 * Loads a fresh copy of the adapter, with `rules` and `dirty` from the same copy of core.
 * With `server`, it loads with no `document`, as on a server, so on React 16
 * and 17 it picks its server fallback. React itself stays the one copy,
 * since Node loads it.
 */
async function loadAdapter(server: boolean): Promise<Adapter> {
  vi.resetModules();
  if (server) vi.stubGlobal("document", undefined);
  try {
    return {
      ...(await import("../src/index.js")),
      ...(await import("../src/plugins.js")),
    };
  } finally {
    vi.unstubAllGlobals();
  }
}

interface Order {
  customer: string;
  plan: "free" | "pro";
  lines: { item: string }[];
}
const initial: Order = { customer: "Ada", plan: "free", lines: [{ item: "pen" }, { item: "ink" }] };

/** Commits by component instance, counted in an effect, so only on the client. */
const commits = new Map<string, number>();

function useCommits(name: string): void {
  useEffect(() => {
    commits.set(name, (commits.get(name) ?? 0) + 1);
  });
}

function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  useCommits(props.field.id);
  return (
    <label htmlFor={props.field.id}>
      {props.label}
      <input {...props.field.inputProps()} />
    </label>
  );
}

/** Two order forms, built on one copy of the adapter. `ids` gives each form an `id`. */
function makeApp(adapter: Adapter, ids: boolean) {
  const order = adapter.createForms({ plugins: [adapter.dirty()], fields: { TextField } }).define({ defaultValues: initial });

  function Plan() {
    const plan = adapter.useFormContext(order).root.at("plan");
    return (
      <>
        <input {...adapter.useInputProps(plan, { kind: "radio", value: "free" })} />
        <input {...adapter.useInputProps(plan, { kind: "radio", value: "pro" })} />
      </>
    );
  }

  function Status() {
    const form = adapter.useFormContext();
    const dirty = adapter.useFormState(form, (snapshot) => snapshot.dirty);
    useCommits(`${form.id} status`);
    return <p>{dirty ? "dirty" : "clean"}</p>;
  }

  function OrderForm(props: { readonly id: string }) {
    const form = adapter.useForm(order, ids ? { id: props.id } : {});
    return (
      <form.Form>
        {(formProps) => (
          <form {...formProps}>
            <form.TextField name="customer" label="Customer" />
            <Plan />
            <form.Items name="lines">{(line) => <form.TextField handle={line.at("item")} label="Item" />}</form.Items>
            <Status />
          </form>
        )}
      </form.Form>
    );
  }

  return function App() {
    return (
      <main>
        <OrderForm id="first" />
        <OrderForm id="second" />
      </main>
    );
  };
}

/** Renders on the server copy of the adapter, then hydrates on a client copy. */
async function serverThenClient(ids: boolean): Promise<HTMLElement> {
  const ServerApp = makeApp(await loadAdapter(true), ids);
  const html = renderToString(<ServerApp />);
  const container = document.body.appendChild(document.createElement("div"));
  container.innerHTML = html;
  const serverIds = [...container.querySelectorAll("[id]")].map((element) => element.id);
  expect(new Set(serverIds).size).toBe(serverIds.length);
  expect(serverIds.length).toBeGreaterThan(8);

  const ClientApp = makeApp(await loadAdapter(false), ids);
  const recoverable = vi.fn<(error: unknown) => void>();
  await hydrate(container, <ClientApp />, recoverable);
  expect(recoverable).not.toHaveBeenCalled();
  expect([...container.querySelectorAll("[id]")].map((element) => element.id)).toEqual(serverIds);
  return container;
}

const missingId = /server rendered without an `id`/;

describe("server rendering and hydration", () => {
  it("hydrates forms with an id, with no warning, and they stay live", async () => {
    const container = await serverThenClient(true);
    const customer = container.querySelector<HTMLInputElement>("#first--customer");
    expect(customer?.value).toBe("Ada");
    expect(container.querySelector("#first p")?.textContent).toBe("clean");
    await act(() => fireEvent.change(customer ?? container, { target: { value: "Grace" } }));
    expect(customer?.value).toBe("Grace");
    expect(container.querySelector("#first p")?.textContent).toBe("dirty");
    expect(container.querySelector("#second p")?.textContent).toBe("clean");
  });

  it("commits each field as often as the rest of the form when it hydrates", async () => {
    commits.clear();
    await serverThenClient(true);
    // StrictMode runs mount effects twice on React 18 and later, so the
    // count to match is the one from a component that reads form state.
    expect(commits.size).toBe(8);
    expect(new Set(commits.values()).size).toBe(1);
  });

  it.runIf(modern)("hydrates forms without an id on React 18 and later", async () => {
    const container = await serverThenClient(false);
    expect(container.querySelector<HTMLInputElement>("form input")?.value).toBe("Ada");
  });

  it("warns once about forms server rendered without an id, on React 16 and 17 only", async () => {
    vi.mocked(console.warn).mockImplementation(() => {});
    const Unnamed = makeApp(await loadAdapter(true), false);
    renderToString(<Unnamed />);
    renderToString(<Unnamed />);
    const warnings = vi.mocked(console.warn).mock.calls.filter(([message]) => missingId.test(String(message)));
    expect(warnings).toHaveLength(modern ? 0 : 1);
    vi.mocked(console.warn).mockClear();
  });

  it("doesn't warn when an id is passed", async () => {
    const Named = makeApp(await loadAdapter(true), true);
    renderToString(<Named />);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

interface Shipping {
  sameAsBilling: boolean;
  gift: boolean;
  street: string;
  note: string;
  city: string;
}

/** A form whose `rules` disable `street` and hide `note` from the start, on one copy of the adapter. */
function makeShipping(adapter: Adapter) {
  const shippingRules = adapter.rules<Shipping>({
    street: (value) => ({ disabled: value.sameAsBilling }),
    note: (value) => ({ hidden: !value.gift }),
  });

  interface RuledTextProps {
    readonly field: FieldApi<string>;
    readonly label: string;
  }

  function RuledText({ field, label }: RuledTextProps) {
    useCommits(label);
    if (shippingRules.meta(field).hidden) return null;
    return <input aria-label={label} {...field.inputProps()} />;
  }

  const shipping = adapter.createForms({ fields: { RuledText } }).define({
    defaultValues: { sameAsBilling: true, gift: false, street: "1 Main St", note: "", city: "Oslo" },
    plugins: [shippingRules],
  });

  return function ShippingForm() {
    const form = adapter.useForm(shipping, { id: "shipping" });
    return (
      <form {...form.formProps}>
        <form.RuledText name="street" label="street" />
        <form.RuledText name="note" label="note" />
        <form.RuledText name="city" label="city" />
      </form>
    );
  };
}

describe("rules in server rendering", () => {
  it("renders what rules set in server HTML, and hydrates it with no mismatch and no extra commit", async () => {
    const Server = makeShipping(await loadAdapter(true));
    const container = document.body.appendChild(document.createElement("div"));
    container.innerHTML = renderToString(<Server />);
    expect(container.querySelector<HTMLInputElement>("[aria-label=street]")?.disabled).toBe(true);
    expect(container.querySelector("[aria-label=note]")).toBeNull();

    commits.clear();
    const Client = makeShipping(await loadAdapter(false));
    const recoverable = vi.fn<(error: unknown) => void>();
    await hydrate(container, <Client />, recoverable);
    expect(recoverable).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>("[aria-label=street]")?.disabled).toBe(true);
    expect(container.querySelector("[aria-label=note]")).toBeNull();
    // The ruled fields commit as often as the plain one, so the rules caused no second render.
    expect(commits.get("street")).toBe(commits.get("city"));
    expect(commits.get("note")).toBe(commits.get("city"));
  });
});
