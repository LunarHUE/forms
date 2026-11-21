import { act, fireEvent } from "@testing-library/react";
import { type ReactNode, StrictMode, Suspense, use, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { createForms, type FieldApi, defineField, type HandleOf, inputProps, useForm } from "./index.js";
import { ruled, rules } from "./plugins.js";
import { digits, masked } from "./text.js";

/** Shows "5551234" as "(555) 123-4". */
function formatPhone(value: string): string {
  if (value.length > 6) return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
  if (value.length > 3) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
  return value;
}

interface InputProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

/** A text input that renders nothing while `rules` hides its field. */
function TextInput({ field: text, label }: InputProps) {
  if (rules.meta(text).hidden) return null;
  return <input aria-label={label} {...inputProps(text)} />;
}

const PhoneField = defineField(TextInput, masked({ clean: digits, display: formatPhone }));

const forms = createForms({ plugins: [rules()], fields: { TextField: TextInput, PhoneField } });

interface Address {
  same: boolean;
  street: string;
}

const AddressShape = forms.fieldset<Address, typeof rules>(ruled({ street: (address) => ({ hidden: address.same }) }));

function AddressFields({ handle, label }: { readonly handle: HandleOf<typeof AddressShape>; readonly label: string }) {
  const scope = AddressShape.scope(handle);
  return <scope.TextField name="street" label={label} />;
}

const checkout = forms.define(
  {
    defaultValues: {
      phone: "555-1234",
      later: "555x9",
      billing: { same: true, street: "1 Main St" },
      shipping: { same: true, street: "2 Side St" },
    },
  },
  // The shipping fieldset renders behind a boundary that may hydrate after the store has listeners, so it is pinned.
  AddressShape.at("shipping"),
);

// Unset on the server. The client sets it to hold the boundary back until the test lets it go.
let held: Promise<void> | undefined;

function Held({ children }: { readonly children: ReactNode }) {
  if (held) use(held);
  return children;
}

function Checkout() {
  const form = useForm(checkout, { id: "checkout" });
  const [more, setMore] = useState(false);
  return (
    <form {...form.formProps}>
      <form.PhoneField name="phone" label="phone" />
      <AddressFields handle={form.root.at("billing")} label="billing" />
      <Suspense fallback={null}>
        <Held>
          <AddressFields handle={form.root.at("shipping")} label="shipping" />
        </Held>
      </Suspense>
      {more ? (
        <form.PhoneField name="later" label="later" />
      ) : (
        <button type="button" onClick={() => setMore(true)}>
          more
        </button>
      )}
    </form>
  );
}

const input = (container: HTMLElement, label: string) => container.querySelector<HTMLInputElement>(`[aria-label=${label}]`);

it("server renders what a field type's and a fieldset's parts did, and hydrates with no mismatch", async () => {
  const container = document.body.appendChild(document.createElement("div"));
  container.innerHTML = renderToString(<Checkout />);
  expect(input(container, "phone")?.value).toBe("(555) 123-4");
  expect(input(container, "billing")).toBeNull();
  expect(input(container, "shipping")).toBeNull();

  let release: (() => void) | undefined;
  held = new Promise((resolve) => {
    release = resolve;
  });
  const errors = vi.spyOn(console, "error");
  const recoverable = vi.fn<(error: unknown) => void>();
  await act(async () => {
    hydrateRoot(
      container,
      <StrictMode>
        <Checkout />
      </StrictMode>,
      { onRecoverableError: recoverable },
    );
  });
  await act(async () => {
    release?.();
  });
  held = undefined;
  expect(recoverable).not.toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
  expect(input(container, "phone")?.value).toBe("(555) 123-4");
  expect(input(container, "shipping")).toBeNull();

  // A field type mounted later attaches on a microtask and cleans its field then.
  await act(async () => {
    fireEvent.click(container.querySelector("button") ?? container);
  });
  expect(input(container, "later")?.value).toBe("(555) 9");
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
  container.remove();
});

it("checks a field type's and a fieldset's plugins against the form", () => {
  const bare = createForms({ fields: { PhoneField } });
  const form = bare.define({ defaultValues: { phone: "" } }).createStore();
  // The cast skips the type error, to reach the runtime check.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  expect(() => AddressShape.scope(form.root as never)).toThrow(/Add rules\(\) to this form's plugins/);
});
