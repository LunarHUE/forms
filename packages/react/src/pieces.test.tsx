import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { createForms, inputProps, useForm } from "./index.js";
import { digits, mask } from "./plugins/mask.js";

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
