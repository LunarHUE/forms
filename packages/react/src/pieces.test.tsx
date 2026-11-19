import { act, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createForms, inputProps, useForm } from "./index.js";
import { digits, mask } from "./plugins/mask.js";
import { persist } from "./plugins/persist.js";

/** Shows "5551234" as "(555) 123-4". */
function formatPhone(value: string): string {
  if (value.length > 6) return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
  if (value.length > 3) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
  return value;
}

const forms = createForms();
const order = forms.define({
  defaultValues: { phone: "5551234", price: 3, name: "" },
  plugins: [mask({ phone: { clean: digits, display: formatPhone } })],
});

const holder: { root?: { peek(): { value: unknown } } } = {};

function Order({ fromEvent }: { readonly fromEvent: boolean }) {
  const form = useForm(order, { id: "order" });
  useEffect(() => {
    holder.root = form.root;
  });
  return (
    <>
      <form.Field name="phone">
        {(field) => (
          <input
            aria-label="phone"
            ref={field.ref}
            value={field.text}
            // Without the event, `setText` finds the focused element `ref` recorded.
            onChange={(event) => (fromEvent ? field.setText(event.target.value, event) : field.setText(event.target.value))}
            onBlur={field.handleBlur}
          />
        )}
      </form.Field>
      <form.Field name="price">
        {(field) => (
          <input
            aria-label="price"
            inputMode="decimal"
            ref={field.ref}
            value={field.text}
            onChange={(event) => field.setNumberText(event.target.value)}
            onBlur={field.handleBlur}
          />
        )}
      </form.Field>
      <form.Field name="name">{(field) => <input aria-label="name" {...inputProps(field)} />}</form.Field>
    </>
  );
}

const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const valueOf = (name: string): unknown => {
  const value = holder.root?.peek().value;
  return typeof value === "object" && value !== null ? Reflect.get(value, name) : undefined;
};

describe("field pieces", () => {
  it.each([true, false])("keep the caret after a character typed in the middle (event passed: %s)", async (fromEvent) => {
    render(<Order fromEvent={fromEvent} />);
    const phone = input("phone");
    expect(phone.value).toBe("(555) 123-4");
    await userEvent.setup().type(phone, "9", { initialSelectionStart: 7, initialSelectionEnd: 7 });
    expect(phone.value).toBe("(555) 192-34");
    expect(phone.selectionStart).toBe(8);
    expect(valueOf("phone")).toBe("55519234");
  });

  it("keep number text while it is typed and drop it on blur", async () => {
    render(<Order fromEvent />);
    const price = input("price");
    const user = userEvent.setup();
    await user.clear(price);
    await user.type(price, "-");
    expect(price.value).toBe("-");
    expect(valueOf("price")).toBeUndefined();
    await user.type(price, "12.");
    expect(price.value).toBe("-12.");
    expect(valueOf("price")).toBe(-12);
    await user.tab();
    expect(price.value).toBe("-12");
  });

  it("bind a plain input through inputProps(field)", async () => {
    render(<Order fromEvent />);
    await userEvent.setup().type(input("name"), "Ada");
    expect(valueOf("name")).toBe("Ada");
    expect(input("name").id).toBe("order--name");
  });
});

/** Storage that holds one saved draft, for `persist`. */
function savedDraft(value: unknown) {
  const items = new Map([["draft", JSON.stringify(value)]]);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, saved: string) => void items.set(key, saved),
    removeItem: (key: string) => void items.delete(key),
  };
}

const settings = createForms().define({
  defaultValues: { phone: "", price: 3, terms: false, size: "s" },
  plugins: [
    persist("draft", savedDraft({ phone: "5551234", price: 12, terms: true, size: "l" })),
    mask({ phone: { clean: digits, display: formatPhone } }),
  ],
});

const resets: { reset?: () => void } = {};

/** Binds each field the way a primitive library takes it: a value or text, and a setter. */
function Settings() {
  const form = useForm(settings, { id: "settings" });
  useEffect(() => {
    resets.reset = () => form.root.reset();
  });
  return (
    <>
      <form.Field name="phone">
        {(field) => (
          <input
            aria-label="phone"
            ref={field.ref}
            value={field.text}
            onChange={(event) => field.setText(event.target.value, event)}
            onBlur={field.handleBlur}
          />
        )}
      </form.Field>
      <form.Field name="price">
        {(field) => (
          <input
            aria-label="price"
            ref={field.ref}
            value={field.text}
            onChange={(event) => field.setNumberText(event.target.value)}
            onBlur={field.handleBlur}
          />
        )}
      </form.Field>
      <form.Field name="terms">
        {(field) => (
          <input
            type="checkbox"
            aria-label="terms"
            ref={field.ref}
            checked={field.value}
            onChange={(event) => field.setValue(event.target.checked)}
          />
        )}
      </form.Field>
      <form.Field name="size">
        {(field) => (
          <select aria-label="size" {...inputProps(field, { kind: "select", empty: "" })}>
            <option value="s">Small</option>
            <option value="l">Large</option>
          </select>
        )}
      </form.Field>
    </>
  );
}

const checkbox = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const select = (label: string) => screen.getByLabelText<HTMLSelectElement>(label);

describe("restored and reset values", () => {
  it("show in elements bound through text and value", async () => {
    render(<Settings />);
    expect(input("phone").value).toBe("(555) 123-4");
    expect(input("price").value).toBe("12");
    expect(checkbox("terms").checked).toBe(true);
    expect(select("size").value).toBe("l");
    await act(async () => resets.reset?.());
    expect(input("phone").value).toBe("");
    expect(input("price").value).toBe("3");
    expect(checkbox("terms").checked).toBe(false);
    expect(select("size").value).toBe("s");
  });

  it("replace number text typed into a focused input", async () => {
    render(<Settings />);
    const user = userEvent.setup();
    await user.clear(input("price"));
    await user.type(input("price"), "4.");
    expect(input("price").value).toBe("4.");
    await act(async () => resets.reset?.());
    expect(document.activeElement).toBe(input("price"));
    expect(input("price").value).toBe("3");
  });
});

/** The same fields with no saved draft, for server rendering. */
const plain = createForms().define({ defaultValues: { name: "Ada", terms: true, size: "l" } });

function Plain() {
  const form = useForm(plain, { id: "plain" });
  return (
    <>
      <form.Field name="name">
        {(field) => <input aria-label="name" ref={field.ref} value={field.text} onChange={(event) => field.setText(event.target.value)} />}
      </form.Field>
      <form.Field name="terms">{(field) => <input aria-label="terms" {...inputProps(field, { kind: "checkbox" })} />}</form.Field>
      <form.Field name="size">
        {(field) => (
          <select aria-label="size" {...inputProps(field, { kind: "select", empty: "" })}>
            <option value="s">Small</option>
            <option value="l">Large</option>
          </select>
        )}
      </form.Field>
    </>
  );
}

it("ref puts back what the browser restored before hydration", async () => {
  const container = document.body.appendChild(document.createElement("div"));
  container.innerHTML = renderToString(<Plain />);
  // A browser can fill the controls back in from before a reload once it parses the markup.
  const restored = (label: string) => within(container).getByLabelText<HTMLInputElement & HTMLSelectElement>(label);
  restored("name").value = "Grace";
  restored("terms").checked = false;
  restored("size").value = "s";
  await act(async () => {
    hydrateRoot(container, <Plain />);
  });
  expect(restored("name").value).toBe("Ada");
  expect(restored("terms").checked).toBe(true);
  expect(restored("size").value).toBe("l");
  container.remove();
});
