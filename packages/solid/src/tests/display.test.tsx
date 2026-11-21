import { describe, expect, it } from "vitest";
import { createForm, createForms, type FieldApi, defineField, type FormOf, createField, inputProps, textareaProps, selectProps } from "../index.js";
import { digits, type MaskConfig, masked, upper } from "../text.js";
import { choose, getAs, mount, settle } from "./dom.js";
import { formatPhone } from "./ssr-app.js";

/** A string field component, only for its field type. */
const Text = (_props: { readonly field: FieldApi<string> }) => null;
/** A mask pinned at `name`, as a field type that may not render pins it on the definition. */
const masking = <K extends string>(name: K, config: MaskConfig) => defineField(Text, masked(config)).at(name);

const forms = createForms({ plugins: [] });
const Contact = forms.define(
  { defaultValues: { phone: "5551234", zip: "ab1", notes: "12", code: "1" } },
  masking("phone", { clean: digits, display: formatPhone }),
  masking("zip", { clean: upper }),
  masking("notes", { clean: digits, display: (value) => `#${value}` }),
  masking("code", { clean: digits, display: (value) => `code ${value}` }),
);
type ContactForm = FormOf<typeof Contact>;

/** Mounts the contact form and returns it with its controls. */
function mountContact() {
  let form: ContactForm | undefined;
  const { host } = mount(() => {
    const created = createForm(Contact, { id: "contact" });
    form = created;
    const root = created.root;
    return (
      <>
        <input aria-label="phone" {...inputProps(createField(root.at("phone")), { type: "tel" })} />
        <input aria-label="zip" {...inputProps(createField(root.at("zip")))} />
        <textarea aria-label="notes" {...textareaProps(createField(root.at("notes")))} />
        <select aria-label="code" {...selectProps(createField(root.at("code")), { empty: "" })}>
          <option value="1">One</option>
          <option value="2">Two</option>
        </select>
      </>
    );
  });
  if (!form) throw new Error("The form was not created.");
  const found = form;
  return {
    form: found,
    phone: getAs(host, "[aria-label=phone]", HTMLInputElement),
    zip: getAs(host, "[aria-label=zip]", HTMLInputElement),
    notes: getAs(host, "[aria-label=notes]", HTMLTextAreaElement),
    code: getAs(host, "[aria-label=code]", HTMLSelectElement),
    value: (name: "phone" | "zip" | "notes") => found.root.at(name).peek().value,
  };
}

/**
 * Edits a text control as a browser does: `insert` replaces the text from
 * `start` to `end`, the caret goes after it, then `input` fires with
 * `inputType`. Then Solid applies what the edit queued.
 */
async function edit(element: HTMLInputElement | HTMLTextAreaElement, start: number, end: number, insert: string, inputType: string) {
  const text = element.value;
  element.value = text.slice(0, start) + insert + text.slice(end);
  element.setSelectionRange(start + insert.length, start + insert.length);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data: insert || null }));
  await settle();
}

const typeAt = (element: HTMLInputElement | HTMLTextAreaElement, at: number, text: string) => edit(element, at, at, text, "insertText");
const backspace = (element: HTMLInputElement, at: number) => edit(element, at - 1, at, "", "deleteContentBackward");
const forwardDelete = (element: HTMLInputElement, at: number) => edit(element, at, at + 1, "", "deleteContentForward");

describe("display", () => {
  it("shows the display text while the store holds the clean value", async () => {
    const { phone, value } = mountContact();
    expect(phone.value).toBe("(555) 123-4");
    await typeAt(phone, 11, "5");
    expect(phone.value).toBe("(555) 123-45");
    expect(phone.selectionStart).toBe(12);
    expect(value("phone")).toBe("55512345");
  });

  it("keeps the caret after a character typed in the middle", async () => {
    const { phone, value } = mountContact();
    await typeAt(phone, 7, "9");
    expect(phone.value).toBe("(555) 192-34");
    expect(phone.selectionStart).toBe(8);
    expect(value("phone")).toBe("55519234");
  });

  it("steps back across a character the display added on backspace", async () => {
    const { phone, value } = mountContact();
    await backspace(phone, 10);
    expect(phone.value).toBe("(555) 123-4");
    expect(phone.selectionStart).toBe(9);
    await backspace(phone, 9);
    expect(phone.value).toBe("(555) 124");
    expect(phone.selectionStart).toBe(8);
    expect(value("phone")).toBe("555124");
  });

  it("steps over a character the display added on a forward delete", async () => {
    const { phone, value } = mountContact();
    await forwardDelete(phone, 9);
    expect(phone.value).toBe("(555) 123-4");
    expect(phone.selectionStart).toBe(10);
    await forwardDelete(phone, 10);
    expect(phone.value).toBe("(555) 123");
    expect(value("phone")).toBe("555123");
  });

  it("puts the caret after a typed-over selection", async () => {
    const { phone, value } = mountContact();
    await edit(phone, 6, 9, "7", "insertText");
    expect(phone.value).toBe("(555) 74");
    expect(phone.selectionStart).toBe(7);
    expect(value("phone")).toBe("55574");
  });

  it("puts the caret after a paste", async () => {
    const { phone, value } = mountContact();
    await edit(phone, 6, 6, "88", "insertFromPaste");
    expect(phone.value).toBe("(555) 881-234");
    expect(phone.selectionStart).toBe(8);
    expect(value("phone")).toBe("555881234");
  });

  it("leaves the caret where it was when the typed character is dropped", async () => {
    const { phone, value } = mountContact();
    await typeAt(phone, 6, "a");
    expect(phone.value).toBe("(555) 123-4");
    expect(phone.selectionStart).toBe(6);
    expect(value("phone")).toBe("5551234");
  });

  it("shows a textarea's display text and keeps its caret", async () => {
    const { notes, value } = mountContact();
    expect(notes.value).toBe("#12");
    await typeAt(notes, 2, "3");
    expect(notes.value).toBe("#132");
    expect(notes.selectionStart).toBe(3);
    expect(value("notes")).toBe("132");
  });

  it("shows the display text of a value written from outside", async () => {
    const { form, phone } = mountContact();
    form.root.at("phone").setValue("1-2-3-4");
    await settle();
    expect(phone.value).toBe("(123) 4");
  });

  it("leaves an input with no display as it was: it shows the clean value", async () => {
    const { zip, value } = mountContact();
    expect(zip.value).toBe("AB1");
    await typeAt(zip, 1, "C");
    expect(zip.value).toBe("ACB1");
    expect(zip.selectionStart).toBe(2);
    expect(value("zip")).toBe("ACB1");
  });

  it("ignores the display on a select", async () => {
    const { code, form } = mountContact();
    expect(code.value).toBe("1");
    choose(code, "2");
    await settle();
    expect(form.root.at("code").peek().value).toBe("2");
    expect(code.value).toBe("2");
  });
});

describe("two masks on one field", () => {
  const Twice = forms.define(
    { defaultValues: { phone: "5551234" } },
    masking("phone", { clean: digits, display: formatPhone }),
    masking("phone", { clean: digits, display: (text) => `other ${text}` }),
  );

  it("shows the display of the part that attaches first", async () => {
    const { host } = mount(() => {
      const form = createForm(Twice);
      return <input aria-label="phone" {...inputProps(createField(form.root.at("phone")))} />;
    });
    const phone = getAs(host, "input", HTMLInputElement);
    expect(phone.value).toBe("(555) 123-4");
    await typeAt(phone, 7, "9");
    expect(phone.value).toBe("(555) 192-34");
    expect(phone.selectionStart).toBe(8);
  });
});
