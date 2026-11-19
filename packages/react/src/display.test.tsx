import { act, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createForms, type FieldApi, field as fieldType, type FormOf, useForm, useInputProps } from "./index.js";
import { digits, mask, type MaskConfig, masked, upper } from "./plugins.js";

/** Shows "5551234" as "(555) 123-4". */
function formatPhone(value: string): string {
  if (value.length > 6) return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
  if (value.length > 3) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
  return value;
}

interface Contact {
  phone: string;
  zip: string;
  notes: string;
  code: string;
}
/** A string field component, only for its field type. */
const Text = (_props: { readonly field: FieldApi<string> }) => null;
/** A mask pinned at `name`, as a field type that may not render pins it on the definition. */
const masking = <K extends string>(name: K, config: MaskConfig) => fieldType(Text, masked(config)).at(name);

const forms = createForms({ plugins: [mask()] });
const contact = forms.define(
  { defaultValues: { phone: "5551234", zip: "ab1", notes: "12", code: "1" } satisfies Contact },
  masking("phone", { clean: digits, display: formatPhone }),
  masking("zip", { clean: upper }),
  masking("notes", { clean: digits, display: (value) => `#${value}` }),
  masking("code", { clean: digits, display: (value) => `code ${value}` }),
);

const holder: { form?: FormOf<typeof contact> } = {};
const value = (name: keyof Contact) => holder.form?.root.at(name).peek().value;

function ContactForm() {
  const form = useForm(contact, { id: "contact" });
  useEffect(() => {
    holder.form = form;
  });
  const root = form.root;
  return (
    <>
      <input aria-label="phone" {...useInputProps(root.at("phone"), { type: "tel" })} />
      <input aria-label="zip" {...useInputProps(root.at("zip"))} />
      <textarea aria-label="notes" {...useInputProps(root.at("notes"), { kind: "textarea" })} />
      <select aria-label="code" {...useInputProps(root.at("code"), { kind: "select", empty: "" })}>
        <option value="1">One</option>
        <option value="2">Two</option>
      </select>
    </>
  );
}

const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label);

describe("display", () => {
  it("shows the display text while the store holds the clean value", async () => {
    render(<ContactForm />);
    const phone = field("phone");
    expect(phone.value).toBe("(555) 123-4");
    await userEvent.setup().type(phone, "5");
    expect(phone.value).toBe("(555) 123-45");
    expect(phone.selectionStart).toBe(12);
    expect(value("phone")).toBe("55512345");
  });

  it("keeps the caret after a character typed in the middle", async () => {
    render(<ContactForm />);
    const phone = field("phone");
    await userEvent.setup().type(phone, "9", { initialSelectionStart: 7, initialSelectionEnd: 7 });
    expect(phone.value).toBe("(555) 192-34");
    expect(phone.selectionStart).toBe(8);
    expect(value("phone")).toBe("55519234");
  });

  it("steps back across a character the display added on backspace", async () => {
    render(<ContactForm />);
    const user = userEvent.setup();
    const phone = field("phone");
    await user.type(phone, "{Backspace}", { initialSelectionStart: 10, initialSelectionEnd: 10 });
    expect(phone.value).toBe("(555) 123-4");
    expect(phone.selectionStart).toBe(9);
    await user.keyboard("{Backspace}");
    expect(phone.value).toBe("(555) 124");
    expect(phone.selectionStart).toBe(8);
    expect(value("phone")).toBe("555124");
  });

  it("steps over a character the display added on a forward delete", async () => {
    render(<ContactForm />);
    const user = userEvent.setup();
    const phone = field("phone");
    await user.type(phone, "{Delete}", { initialSelectionStart: 9, initialSelectionEnd: 9 });
    expect(phone.value).toBe("(555) 123-4");
    expect(phone.selectionStart).toBe(10);
    await user.keyboard("{Delete}");
    expect(phone.value).toBe("(555) 123");
    expect(value("phone")).toBe("555123");
  });

  it("puts the caret after a typed-over selection", async () => {
    render(<ContactForm />);
    const phone = field("phone");
    await userEvent.setup().type(phone, "7", { initialSelectionStart: 6, initialSelectionEnd: 9 });
    expect(phone.value).toBe("(555) 74");
    expect(phone.selectionStart).toBe(7);
    expect(value("phone")).toBe("55574");
  });

  it("puts the caret after a paste", async () => {
    render(<ContactForm />);
    const user = userEvent.setup();
    const phone = field("phone");
    phone.focus();
    phone.setSelectionRange(6, 6);
    await user.paste("88");
    expect(phone.value).toBe("(555) 881-234");
    expect(phone.selectionStart).toBe(8);
    expect(value("phone")).toBe("555881234");
  });

  it("leaves the caret where it was when the typed character is dropped", async () => {
    render(<ContactForm />);
    const phone = field("phone");
    await userEvent.setup().type(phone, "a", { initialSelectionStart: 6, initialSelectionEnd: 6 });
    expect(phone.value).toBe("(555) 123-4");
    expect(phone.selectionStart).toBe(6);
    expect(value("phone")).toBe("5551234");
  });

  it("shows a textarea's display text and keeps its caret", async () => {
    render(<ContactForm />);
    const notes = screen.getByLabelText<HTMLTextAreaElement>("notes");
    expect(notes.value).toBe("#12");
    await userEvent.setup().type(notes, "3", { initialSelectionStart: 2, initialSelectionEnd: 2 });
    expect(notes.value).toBe("#132");
    expect(notes.selectionStart).toBe(3);
    expect(value("notes")).toBe("132");
  });

  it("shows the display text of a value written from outside", () => {
    render(<ContactForm />);
    act(() => holder.form?.root.at("phone").setValue("1-2-3-4"));
    expect(field("phone").value).toBe("(123) 4");
  });

  it("leaves an input with no display as it was: it shows the clean value", async () => {
    render(<ContactForm />);
    const zip = field("zip");
    expect(zip.value).toBe("AB1");
    await userEvent.setup().type(zip, "C", { initialSelectionStart: 1, initialSelectionEnd: 1 });
    expect(zip.value).toBe("ACB1");
    expect(zip.selectionStart).toBe(2);
    expect(value("zip")).toBe("ACB1");
  });

  it("ignores the display on a select", () => {
    render(<ContactForm />);
    expect(screen.getByLabelText<HTMLSelectElement>("code").value).toBe("1");
  });

  it("renders the display text on the server and hydrates without a warning", () => {
    const html = renderToString(<ContactForm />);
    expect(html).toContain('value="(555) 123-4"');
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    act(() => void hydrateRoot(container, <ContactForm />));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
    expect(container.querySelector("input")?.value).toBe("(555) 123-4");
    container.remove();
  });
});

describe("two masks on one field", () => {
  const twice = forms.define(
    { defaultValues: { phone: "5551234" } },
    masking("phone", { clean: digits, display: formatPhone }),
    masking("phone", { clean: digits, display: (text) => `other ${text}` }),
  );

  function Twice() {
    const form = useForm(twice);
    return <input aria-label="phone" {...useInputProps(form.root.at("phone"))} />;
  }

  it("shows the display of the part that attaches first", async () => {
    render(<Twice />);
    const phone = field("phone");
    expect(phone.value).toBe("(555) 123-4");
    await userEvent.setup().type(phone, "9", { initialSelectionStart: 7, initialSelectionEnd: 7 });
    expect(phone.value).toBe("(555) 192-34");
    expect(phone.selectionStart).toBe(8);
  });
});
