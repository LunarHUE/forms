import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import { createField, createForm, createForms, type FieldApi, defineField, type FormOf, inputProps, numberPieces, selectProps } from "../index.js";
import { digits, mask, masked, persist } from "../plugins.js";
import { get, getAs, mount, settle, typeText } from "./dom.js";
import { formatPhone } from "./ssr-app.js";

/** Storage that holds one saved draft, for `persist`. */
function savedDraft(value: unknown) {
  const items = new Map([["draft", JSON.stringify(value)]]);
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, saved: string) => void items.set(key, saved),
    removeItem: (key: string) => void items.delete(key),
  };
}

/** A phone field type, pinned on the definition since these tests bind their inputs by hand. */
const PhoneField = defineField((_props: { readonly field: FieldApi<string> }) => null, masked({ clean: digits, display: formatPhone }));

const forms = createForms();
const Order = forms.define(
  {
    defaultValues: { phone: "", price: 3, name: "", terms: false, size: "s" },
    plugins: [persist({ key: "draft", storage: savedDraft({ phone: "5551234", price: 12, name: "Ada", terms: true, size: "l" }) }), mask()],
  },
  PhoneField.at("phone"),
);
type OrderForm = FormOf<typeof Order>;

/** Binds each field the way a primitive library takes it: a value or text, and a setter. */
function mountOrder(fromEvent = true) {
  let form: OrderForm | undefined;
  const { host } = mount(() => {
    const created = createForm(Order, { id: "order" });
    form = created;
    return (
      <>
        <created.Field name="phone">
          {(field) => (
            <input
              aria-label="phone"
              ref={field.ref}
              value={field.text}
              onInput={(event) => (fromEvent ? field.setText(event.currentTarget.value, event) : field.setText(event.currentTarget.value))}
              onBlur={field.handleBlur}
            />
          )}
        </created.Field>
        <created.Field name="price">
          {(field) => {
            const number = numberPieces(field, { empty: 0 });
            return (
              <input
                aria-label="price"
                ref={field.ref}
                value={number.text}
                onInput={(event) => number.setText(event.currentTarget.value)}
                onBlur={number.handleBlur}
              />
            );
          }}
        </created.Field>
        <created.Field name="name">{(field) => <input aria-label="name" {...inputProps(field)} />}</created.Field>
        <created.Field name="terms">
          {(field) => (
            <input
              type="checkbox"
              aria-label="terms"
              ref={field.ref}
              checked={field.value}
              onChange={(event) => field.setValue(event.currentTarget.checked)}
            />
          )}
        </created.Field>
        <created.Field name="size">
          {(field) => (
            <select aria-label="size" {...selectProps(field, { empty: "" })}>
              <option value="s">Small</option>
              <option value="l">Large</option>
            </select>
          )}
        </created.Field>
      </>
    );
  });
  if (!form) throw new Error("The form was not created.");
  const found = form;
  return {
    form: found,
    input: (label: string) => get(host, `[aria-label=${label}]`),
    size: getAs(host, "[aria-label=size]", HTMLSelectElement),
    value: (name: "phone" | "price" | "name") => found.root.at(name).peek().value,
  };
}

/** Types `text` at `at`, as a browser does: the DOM changes, the caret moves, then `input` fires. */
async function typeAt(element: HTMLInputElement, at: number, text: string) {
  element.value = element.value.slice(0, at) + text + element.value.slice(at);
  element.setSelectionRange(at + text.length, at + text.length);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  await settle();
}

describe("field pieces", () => {
  it.each([true, false])("keep the caret after a character typed in the middle (event passed: %s)", async (fromEvent) => {
    const { input, value } = mountOrder(fromEvent);
    await settle();
    const phone = input("phone");
    expect(phone.value).toBe("(555) 123-4");
    // Without the event, `setText` finds the focused element `ref` registered.
    phone.focus();
    await typeAt(phone, 7, "9");
    expect(phone.value).toBe("(555) 192-34");
    expect(phone.selectionStart).toBe(8);
    expect(value("phone")).toBe("55519234");
  });

  it("keep number text from numberPieces while it is typed and drop it on blur", async () => {
    const { input, value } = mountOrder();
    const price = input("price");
    typeText(price, "-");
    await settle();
    expect(price.value).toBe("-");
    expect(value("price")).toBe(12);
    typeText(price, "-12.");
    await settle();
    expect(price.value).toBe("-12.");
    expect(value("price")).toBe(-12);
    price.dispatchEvent(new FocusEvent("blur"));
    await settle();
    expect(price.value).toBe("-12");
  });

  it("bind a plain input through inputProps(field)", async () => {
    const { input, value } = mountOrder();
    typeText(input("name"), "Grace");
    await settle();
    expect(value("name")).toBe("Grace");
    expect(input("name").id).toBe("order--name");
  });
});

describe("restored and reset values", () => {
  it("show in elements bound through text and value", async () => {
    const { form, input, size } = mountOrder();
    await settle();
    expect(input("phone").value).toBe("(555) 123-4");
    expect(input("price").value).toBe("12");
    expect(input("name").value).toBe("Ada");
    expect(input("terms").checked).toBe(true);
    expect(size.value).toBe("l");
    form.root.reset();
    await settle();
    expect(input("phone").value).toBe("");
    expect(input("price").value).toBe("3");
    expect(input("name").value).toBe("");
    expect(input("terms").checked).toBe(false);
    expect(size.value).toBe("s");
  });

  it("replace number text typed into a focused input", async () => {
    const { form, input } = mountOrder();
    const price = input("price");
    price.focus();
    typeText(price, "4.");
    await settle();
    expect(price.value).toBe("4.");
    form.root.reset();
    await settle();
    expect(document.activeElement).toBe(price);
    expect(price.value).toBe("3");
  });
});

/** An input of `type` with `value`. */
const inputWith = (type: string, value = "") => Object.assign(document.createElement("input"), { type, value });

const Survey = forms.define({ defaultValues: { name: "Ada", tags: ["b"], plan: "pro", size: "l", agree: true } });

describe("ref", () => {
  it("puts the field's state back in a native control that differs, as after a browser restore", () => {
    const name = inputWith("text", "Grace");
    const [a, b] = ["a", "b"].map((value) => inputWith("checkbox", value));
    const [free, pro] = ["free", "pro"].map((value) => inputWith("radio", value));
    const agree = inputWith("checkbox");
    const select = document.createElement("select");
    select.append(new Option("Small", "s"), new Option("Large", "l"));
    if (!a || !b || !free || !pro) throw new Error("No boxes.");
    a.checked = true;
    free.checked = true;
    // Solid 1 puts the state back in an effect, which runs once the root's function returns.
    const dispose = createRoot((disposeRoot) => {
      const form = createForm(Survey);
      createField(form.root.at("name")).ref(name);
      const tags = createField(form.root.at("tags"));
      tags.ref(a);
      tags.ref(b);
      const plan = createField(form.root.at("plan"));
      plan.ref(free);
      plan.ref(pro);
      createField(form.root.at("agree")).ref(agree);
      createField(form.root.at("size")).ref(select);
      return disposeRoot;
    });
    expect(name.value).toBe("Ada");
    expect([a.checked, b.checked]).toEqual([false, true]);
    expect([free.checked, pro.checked]).toEqual([false, true]);
    expect(agree.checked).toBe(true);
    expect(select.value).toBe("l");
    dispose();
  });
});
