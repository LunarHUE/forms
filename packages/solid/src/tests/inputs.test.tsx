import { errorId as coreErrorId } from "@lunarhue/forms-core";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createForm, createForms, createInputProps, errorId, fieldRef, type FormOf, inputProps } from "../index.js";
import { choose, click, get, getAs, mount, settle, typeText } from "./dom.js";

const forms = createForms({ plugins: [valibot()] });
const Survey = forms.define({
  schema: v.object({
    name: v.pipe(v.string(), v.minLength(1, "Required")),
    bio: v.string(),
    age: v.number(),
    volume: v.number(),
    agree: v.boolean(),
    tags: v.array(v.string()),
    plan: v.picklist(["free", "pro"]),
    color: v.picklist(["red", "green", "blue"]),
  }),
  defaultValues: { volume: 5, color: "red" },
});
type SurveyForm = FormOf<typeof Survey>;

/** Mounts a form and returns it with the host element. */
function mountSurvey(render: (form: SurveyForm) => ReturnType<SurveyForm["Form"]>) {
  let form: SurveyForm | undefined;
  const { host } = mount(() => {
    form = createForm(Survey, { id: "survey" });
    return render(form);
  });
  if (!form) throw new Error("The form was not created.");
  return { form, host };
}

describe("text and textarea", () => {
  it("binds value, name, id, type, aria and blur", async () => {
    const { form, host } = mountSurvey((f) => (
      <f.Field name="name">
        {(field) => (
          <>
            <input {...inputProps(field, { type: "email", describedBy: "hint" })} />
            <p id={field.errorId}>{field.shownErrors[0]?.message}</p>
          </>
        )}
      </f.Field>
    ));
    const input = get(host, "input");
    expect(input.id).toBe(form.root.at("name").id);
    expect(input.type).toBe("email");
    expect(input.name).toBe("name");
    expect(input.getAttribute("aria-describedby")).toBe("hint");
    expect(input.hasAttribute("aria-invalid")).toBe(false);

    input.dispatchEvent(new FocusEvent("blur"));
    await form.root.at("name").validate();
    await settle();
    expect(form.store.getSnapshot(form.root.at("name").path).touched).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(`hint ${errorId(form.root.at("name"))}`);
    expect(getAs(host, `[id="${errorId(form.root.at("name"))}"]`, HTMLElement).textContent).toBe("Required");

    typeText(input, "Ada");
    await settle();
    expect(form.root.at("name").peek().value).toBe("Ada");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("binds a textarea, read-only and disabled", async () => {
    const { form, host } = mountSurvey((f) => <textarea {...createInputProps(f.root.at("bio"), { kind: "textarea" })} />);
    const textarea = getAs(host, "textarea", HTMLTextAreaElement);
    expect(textarea.hasAttribute("type")).toBe(false);
    typeText(textarea, "Hello");
    await settle();
    expect(form.root.at("bio").peek().value).toBe("Hello");
    form.root.at("bio").setReadOnly(true);
    form.root.at("bio").setDisabled(true);
    await settle();
    expect(textarea.readOnly).toBe(true);
    expect(textarea.disabled).toBe(true);
  });
});

describe("number and range", () => {
  it("writes numbers, `empty` for an empty input, and nothing for partial text", async () => {
    const { form, host } = mountSurvey((f) => <f.Field name="age">{(field) => <input {...inputProps(field, { kind: "number" })} />}</f.Field>);
    const input = get(host, "input");
    const age = form.root.at("age");
    expect(input.type).toBe("number");
    expect(input.value).toBe("");

    typeText(input, "42");
    await settle();
    expect(age.peek().value).toBe(42);

    // "1.0" reads as 1. The element keeps the text the user typed.
    typeText(input, "1.0");
    await settle();
    expect(age.peek().value).toBe(1);
    expect(input.value).toBe("1.0");

    // While the text is not a number yet ("1." or "-"), the browser reports
    // an empty value with `badInput`, and the field keeps its number.
    Object.defineProperty(input, "validity", { configurable: true, value: { badInput: true } });
    typeText(input, "");
    await settle();
    expect(age.peek().value).toBe(1);
    Reflect.deleteProperty(input, "validity");

    typeText(input, "");
    await settle();
    expect(age.peek().value).toBeUndefined();

    age.setValue(7);
    await settle();
    expect(input.value).toBe("7");
  });

  it("keeps the typed text until the input loses focus, then shows the stored number", async () => {
    const { form, host } = mountSurvey((f) => <f.Field name="age">{(field) => <input {...inputProps(field, { kind: "number" })} />}</f.Field>);
    const input = get(host, "input");
    const age = form.root.at("age");
    const blur = async () => {
      input.dispatchEvent(new FocusEvent("blur"));
      await settle();
    };

    typeText(input, "2.50");
    await settle();
    expect(age.peek().value).toBe(2.5);
    expect(input.value).toBe("2.50");
    await blur();
    expect(input.value).toBe("2.5");

    // A value set from outside while the input has focus shows at once.
    typeText(input, "3.0");
    await settle();
    age.setValue(4);
    await settle();
    expect(input.value).toBe("4");

    // Text that isn't a number yet gives way to the stored number on blur.
    Object.defineProperty(input, "validity", { configurable: true, value: { badInput: true } });
    typeText(input, "");
    await settle();
    Reflect.deleteProperty(input, "validity");
    expect(age.peek().value).toBe(4);
    await blur();
    expect(input.value).toBe("4");

    typeText(input, "");
    await settle();
    await blur();
    expect(age.peek().value).toBeUndefined();
    expect(input.value).toBe("");
  });

  it("writes the `empty` option and binds a range", async () => {
    const { form, host } = mountSurvey((f) => (
      <input {...createInputProps(f.root.at("volume"), { kind: "number", type: "range", empty: 0 })} />
    ));
    const input = get(host, "input");
    expect(input.type).toBe("range");
    expect(input.value).toBe("5");
    typeText(input, "8");
    await settle();
    expect(form.root.at("volume").peek().value).toBe(8);
  });
});

describe("checkbox", () => {
  it("binds a boolean", async () => {
    const { form, host } = mountSurvey((f) => <input {...createInputProps(f.root.at("agree"), { kind: "checkbox" })} />);
    const box = get(host, "input");
    expect(box.type).toBe("checkbox");
    expect(box.checked).toBe(false);
    expect(box.hasAttribute("value")).toBe(false);
    click(box);
    await settle();
    expect(form.root.at("agree").peek().value).toBe(true);
    form.root.at("agree").setValue(false);
    await settle();
    expect(box.checked).toBe(false);
  });

  it("binds a group to an array, one box per option", async () => {
    const { form, host } = mountSurvey((f) => (
      <f.Field name="tags">
        {(field) => (
          <>
            <input data-tag="news" {...inputProps(field, { kind: "checkbox", value: "news" })} />
            <input data-tag="offers" {...inputProps(field, { kind: "checkbox", value: "offers" })} />
          </>
        )}
      </f.Field>
    ));
    const news = get(host, "[data-tag=news]");
    const offers = get(host, "[data-tag=offers]");
    expect(news.value).toBe("news");
    click(offers);
    click(news);
    await settle();
    expect(form.root.at("tags").peek().value).toEqual(["offers", "news"]);
    click(offers);
    await settle();
    expect(form.root.at("tags").peek().value).toEqual(["news"]);
    expect(offers.checked).toBe(false);
    expect(news.checked).toBe(true);
  });

  it("binds a group of numbers", async () => {
    const Sizes = forms.define({ defaultValues: { sizes: [] as number[] } });
    let form: FormOf<typeof Sizes> | undefined;
    const { host } = mount(() => {
      form = createForm(Sizes);
      return <input {...createInputProps(form.root.at("sizes"), { kind: "checkbox", value: 3 })} />;
    });
    click(get(host, "input"));
    await settle();
    expect(form?.root.at("sizes").peek().value).toEqual([3]);
  });

  it("doesn't write while read-only, and puts the box back", async () => {
    const { form, host } = mountSurvey((f) => <input {...createInputProps(f.root.at("agree"), { kind: "checkbox" })} />);
    form.root.at("agree").setReadOnly(true);
    await settle();
    const box = get(host, "input");
    expect(box.getAttribute("aria-readonly")).toBe("true");
    click(box);
    await settle();
    expect(box.checked).toBe(false);
    expect(form.root.at("agree").peek().value).toBe(false);
  });
});

describe("radio", () => {
  it("writes the chosen option, and doesn't while read-only", async () => {
    const { form, host } = mountSurvey((f) => (
      <f.Field name="plan">
        {(field) => (
          <>
            <input data-plan="free" {...inputProps(field, { kind: "radio", value: "free" })} />
            <input data-plan="pro" {...inputProps(field, { kind: "radio", value: "pro" })} />
          </>
        )}
      </f.Field>
    ));
    const free = get(host, "[data-plan=free]");
    const pro = get(host, "[data-plan=pro]");
    expect(free.type).toBe("radio");
    expect(free.name).toBe("plan");
    expect(free.checked || pro.checked).toBe(false);
    click(pro);
    await settle();
    expect(form.root.at("plan").peek().value).toBe("pro");
    expect(pro.checked).toBe(true);

    form.root.at("plan").setReadOnly(true);
    await settle();
    click(free);
    await settle();
    expect(form.root.at("plan").peek().value).toBe("pro");
    expect(free.checked).toBe(false);
    expect(pro.checked).toBe(true);
  });
});

/** The element a `<label>` with `text` points at. */
function labelled(host: HTMLElement, text: string): HTMLElement | null | undefined {
  const label = [...host.querySelectorAll("label")].find((each) => each.textContent === text);
  return label?.control;
}

describe("ids", () => {
  const Picker = forms.define({
    defaultValues: { size: "", picks: ["a"] as string[] },
    validate: { fields: { size: (value: string) => (value === "" ? { message: "Required" } : undefined) } },
  });

  /**
   * A radio group, a checkbox group over an array, and the array's first
   * item, whose key is `k0`, as its own input. The group has an option named
   * `k0` too.
   */
  function mountPicker() {
    let form: FormOf<typeof Picker> | undefined;
    const { host } = mount(() => {
      const f = createForm(Picker, { id: "pick" });
      form = f;
      const small = createInputProps(f.root.at("size"), { kind: "radio", value: "s" });
      const large = createInputProps(f.root.at("size"), { kind: "radio", value: "m l" });
      const keyed = createInputProps(f.root.at("picks"), { kind: "checkbox", value: "k0" });
      const plain = createInputProps(f.root.at("picks"), { kind: "checkbox", value: "a" });
      const first = createInputProps(f.root.at("picks").item("k0"));
      return (
        <form {...f.formProps}>
          <label for={small.id}>small</label>
          <input data-size="s" {...small} />
          <label for={large.id}>large</label>
          <input data-size="m l" {...large} />
          <label for={keyed.id}>keyed</label>
          <input data-pick="k0" {...keyed} />
          <label for={plain.id}>plain</label>
          <input data-pick="a" {...plain} />
          <input data-first {...first} />
          <p id={errorId(f.root.at("size"))}>size errors</p>
        </form>
      );
    });
    if (!form) throw new Error("The form was not created.");
    return { form, host };
  }

  it("gives each option of a radio or checkbox group its own id", () => {
    const { host } = mountPicker();
    expect(get(host, '[data-size="s"]').id).toBe("pick--size---option-s");
    expect(get(host, '[data-size="m l"]').id).toBe("pick--size---option-m_20_l");
    expect(get(host, '[data-size="m l"]').value).toBe("m l");
    expect(get(host, "[data-pick=k0]").id).toBe("pick--picks---option-k0");
    expect(get(host, "[data-first]").id).toBe("pick--picks--k0");
    expect(get(host, "[data-first]").value).toBe("a");
    expect(labelled(host, "large")).toBe(get(host, '[data-size="m l"]'));
    expect(labelled(host, "plain")).toBe(get(host, "[data-pick=a]"));
  });

  it("renders no duplicate ids, with array items next to a group over the array", () => {
    const { host } = mountPicker();
    const ids = [...host.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points aria-describedby at core's error id and focuses the first radio after an invalid submit", async () => {
    const { form, host } = mountPicker();
    const size = form.root.at("size");
    expect(errorId(size)).toBe(coreErrorId(size.id));
    expect(errorId(size)).toBe("pick--size---error");
    await form.handleSubmit();
    await settle();
    expect(get(host, '[data-size="m l"]').getAttribute("aria-describedby")).toBe(errorId(size));
    expect(host.querySelector(`[id="${errorId(size)}"]`)?.textContent).toBe("size errors");
    expect(document.activeElement).toBe(get(host, '[data-size="s"]'));
  });
});

describe("select", () => {
  it("writes the chosen option, and doesn't while read-only", async () => {
    const { form, host } = mountSurvey((f) => (
      <select {...createInputProps(f.root.at("color"), { kind: "select" })}>
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="blue">Blue</option>
      </select>
    ));
    const select = getAs(host, "select", HTMLSelectElement);
    expect(select.value).toBe("red");
    choose(select, "green");
    await settle();
    expect(form.root.at("color").peek().value).toBe("green");
    form.root.at("color").setValue("blue");
    await settle();
    expect(select.value).toBe("blue");

    form.root.at("color").setReadOnly(true);
    await settle();
    expect(select.getAttribute("aria-readonly")).toBe("true");
    choose(select, "red");
    await settle();
    expect(form.root.at("color").peek().value).toBe("blue");
    expect(select.value).toBe("blue");
  });
});

describe("refs", () => {
  it("registers a custom element as the focus target with fieldRef", async () => {
    const { form, host } = mountSurvey((f) => (
      <form {...f.formProps}>
        <div ref={fieldRef(f.root.at("name"))} tabindex={0} data-custom />
      </form>
    ));
    await form.handleSubmit();
    expect(document.activeElement).toBe(getAs(host, "[data-custom]", HTMLElement));
  });

  it("returns the same props object for the same options", () => {
    let same = false;
    mountSurvey((f) => (
      <f.Field name="name">
        {(field) => {
          same = inputProps(field) === inputProps(field, { kind: "text" }) && inputProps(field) !== inputProps(field, { type: "email" });
          return null;
        }}
      </f.Field>
    ));
    expect(same).toBe(true);
  });
});
