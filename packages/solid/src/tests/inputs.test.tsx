import { errorId as coreErrorId } from "@lunarhue/forms-core";
import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
  checkboxGroupProps,
  checkboxProps,
  createField,
  createForm,
  createForms,
  errorId,
  fieldRef,
  fieldValidators,
  type FormOf,
  inputProps,
  numberPieces,
  numberProps,
  radioProps,
  rangeProps,
  selectProps,
  textareaProps,
} from "../index.js";
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

/** Marks a field's errors as shown: touched, then validated. */
async function showErrors(form: SurveyForm, name: "name" | "age" | "agree" | "plan" | "tags" | "color" | "volume" | "bio"): Promise<void> {
  const handle = form.root.at(name);
  handle.setTouched();
  handle.setErrors([{ message: "Wrong" }]);
  await settle();
}

describe("inputProps", () => {
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
    expect(input.getAttribute("aria-describedby")).toBe("hint");
  });

  it("updates the same element when the value, read-only or disabled changes", async () => {
    const { form, host } = mountSurvey((f) => <f.Field name="name">{(field) => <input {...inputProps(field)} />}</f.Field>);
    const input = get(host, "input");
    const name = form.root.at("name");
    expect(input.type).toBe("text");
    name.setValue("Grace");
    await settle();
    expect(get(host, "input")).toBe(input);
    expect(input.value).toBe("Grace");

    name.setReadOnly(true);
    name.setDisabled(true);
    await settle();
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(true);
    typeText(input, "Ada");
    await settle();
    expect(name.peek().value).toBe("Grace");
  });

  it("reads the field lazily, through getters", () => {
    let props: object | undefined;
    mountSurvey((f) => (
      <f.Field name="name">
        {(field) => {
          props = inputProps(field);
          return null;
        }}
      </f.Field>
    ));
    for (const key of ["value", "name", "readonly", "disabled", "aria-invalid", "aria-describedby"]) {
      expect(Object.getOwnPropertyDescriptor(props ?? {}, key)).toHaveProperty("get");
    }
  });

  it("returns the same props object for the same options", () => {
    let same = false;
    mountSurvey((f) => (
      <f.Field name="name">
        {(field) => {
          same =
            inputProps(field) === inputProps(field, { type: "text" }) &&
            inputProps(field) !== inputProps(field, { type: "email" }) &&
            inputProps(field) !== inputProps(field, { describedBy: "hint" });
          return null;
        }}
      </f.Field>
    ));
    expect(same).toBe(true);
  });
});

describe("textareaProps", () => {
  it("binds a textarea, read-only, disabled and describedBy", async () => {
    const { form, host } = mountSurvey((f) => <textarea {...textareaProps(createField(f.root.at("bio")), { describedBy: "bio-hint" })} />);
    const textarea = getAs(host, "textarea", HTMLTextAreaElement);
    expect(textarea.hasAttribute("type")).toBe(false);
    expect(textarea.getAttribute("aria-describedby")).toBe("bio-hint");
    typeText(textarea, "Hello");
    await settle();
    expect(form.root.at("bio").peek().value).toBe("Hello");
    form.root.at("bio").setValue("Bye");
    await settle();
    expect(textarea.value).toBe("Bye");
    await showErrors(form, "bio");
    expect(textarea.getAttribute("aria-describedby")).toBe(`bio-hint ${errorId(form.root.at("bio"))}`);
    form.root.at("bio").setReadOnly(true);
    form.root.at("bio").setDisabled(true);
    await settle();
    expect(textarea.readOnly).toBe(true);
    expect(textarea.disabled).toBe(true);
  });
});

describe("numberProps", () => {
  it("writes numbers, `empty` for an empty input, and nothing for partial text", async () => {
    const { form, host } = mountSurvey((f) => <f.Field name="age">{(field) => <input {...numberProps(field)} />}</f.Field>);
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
    const { form, host } = mountSurvey((f) => <f.Field name="age">{(field) => <input {...numberProps(field)} />}</f.Field>);
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
    expect(age.peek().touched).toBe(true);

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

  it("writes the `empty` option, and nothing while read-only", async () => {
    const { form, host } = mountSurvey((f) => <input {...numberProps(createField(f.root.at("volume")), { empty: 0, describedBy: "unit" })} />);
    const input = get(host, "input");
    const volume = form.root.at("volume");
    expect(input.value).toBe("5");
    expect(input.getAttribute("aria-describedby")).toBe("unit");
    typeText(input, "");
    await settle();
    expect(volume.peek().value).toBe(0);

    volume.setReadOnly(true);
    volume.setDisabled(true);
    await settle();
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(true);
    typeText(input, "9");
    await settle();
    expect(volume.peek().value).toBe(0);
  });
});

describe("numberPieces", () => {
  it("keeps half-typed text in `text`, writes numbers, and drops the text on blur", async () => {
    const { form, host } = mountSurvey((f) => (
      <f.Field name="age">
        {(field) => {
          const number = numberPieces(field);
          return <input value={number.text} onInput={(event) => number.setText(event.currentTarget.value)} onBlur={number.handleBlur} />;
        }}
      </f.Field>
    ));
    const input = get(host, "input");
    const age = form.root.at("age");
    typeText(input, "-");
    await settle();
    expect(age.peek().value).toBeUndefined();
    expect(input.value).toBe("-");
    typeText(input, "12.");
    await settle();
    expect(age.peek().value).toBe(12);
    expect(input.value).toBe("12.");
    input.dispatchEvent(new FocusEvent("blur"));
    await settle();
    expect(input.value).toBe("12");
    expect(age.peek().touched).toBe(true);
  });

  it("shares the typed text with numberProps, and leaves field.text alone", async () => {
    let text: (() => string) | undefined;
    const { host } = mountSurvey((f) => (
      <f.Field name="age">
        {(field) => {
          text = () => `${numberPieces(field).text}|${field.text}`;
          return <input {...numberProps(field)} />;
        }}
      </f.Field>
    ));
    typeText(get(host, "input"), "3.0");
    await settle();
    expect(text?.()).toBe("3.0|3");
  });
});

describe("rangeProps", () => {
  it("binds a range, and puts the slider back while read-only", async () => {
    const { form, host } = mountSurvey((f) => <input {...rangeProps(createField(f.root.at("volume")))} />);
    const input = get(host, "input");
    const volume = form.root.at("volume");
    expect(input.type).toBe("range");
    expect(input.value).toBe("5");
    typeText(input, "8");
    await settle();
    expect(volume.peek().value).toBe(8);
    volume.setValue(3);
    await settle();
    expect(input.value).toBe("3");

    volume.setReadOnly(true);
    await settle();
    typeText(input, "9");
    await settle();
    expect(volume.peek().value).toBe(3);
    expect(input.value).toBe("3");
  });
});

describe("checkboxProps", () => {
  it("binds a boolean", async () => {
    const { form, host } = mountSurvey((f) => <input {...checkboxProps(createField(f.root.at("agree")))} />);
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

  it("doesn't write while read-only, and puts the box back", async () => {
    const { form, host } = mountSurvey((f) => <input {...checkboxProps(createField(f.root.at("agree")), { describedBy: "terms" })} />);
    form.root.at("agree").setReadOnly(true);
    await settle();
    const box = get(host, "input");
    expect(box.getAttribute("aria-readonly")).toBe("true");
    click(box);
    await settle();
    expect(box.checked).toBe(false);
    expect(form.root.at("agree").peek().value).toBe(false);

    await showErrors(form, "agree");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(box.getAttribute("aria-describedby")).toBe(`terms ${errorId(form.root.at("agree"))}`);
    form.root.at("agree").setDisabled(true);
    await settle();
    expect(box.disabled).toBe(true);
  });
});

describe("checkboxGroupProps", () => {
  it("binds a group to an array, one box per option", async () => {
    const { form, host } = mountSurvey((f) => (
      <f.Field name="tags">
        {(field) => (
          <>
            <input data-tag="news" {...checkboxGroupProps(field, "news")} />
            <input data-tag="offers" {...checkboxGroupProps(field, "offers")} />
          </>
        )}
      </f.Field>
    ));
    const news = get(host, "[data-tag=news]");
    const offers = get(host, "[data-tag=offers]");
    expect(news.value).toBe("news");
    expect(news.name).toBe("tags");
    click(offers);
    click(news);
    await settle();
    expect(form.root.at("tags").peek().value).toEqual(["offers", "news"]);
    click(offers);
    await settle();
    expect(form.root.at("tags").peek().value).toEqual(["news"]);
    expect(offers.checked).toBe(false);
    expect(news.checked).toBe(true);
    form.root.at("tags").setValue(["offers"]);
    await settle();
    expect(offers.checked).toBe(true);
    expect(news.checked).toBe(false);
  });

  it("binds a group of numbers", async () => {
    const Sizes = forms.define({ defaultValues: { sizes: [] as number[] } });
    let form: FormOf<typeof Sizes> | undefined;
    const { host } = mount(() => {
      form = createForm(Sizes);
      return <input {...checkboxGroupProps(createField(form.root.at("sizes")), 3)} />;
    });
    click(get(host, "input"));
    await settle();
    expect(form?.root.at("sizes").peek().value).toEqual([3]);
  });

  it("doesn't write while read-only, and puts the box back", async () => {
    const { form, host } = mountSurvey((f) => <input {...checkboxGroupProps(createField(f.root.at("tags")), "news")} />);
    form.root.at("tags").setReadOnly(true);
    await settle();
    const box = get(host, "input");
    expect(box.getAttribute("aria-readonly")).toBe("true");
    click(box);
    await settle();
    expect(box.checked).toBe(false);
    expect(form.root.at("tags").peek().value).toEqual([]);
  });
});

describe("radioProps", () => {
  it("writes the chosen option, and doesn't while read-only", async () => {
    const { form, host } = mountSurvey((f) => (
      <f.Field name="plan">
        {(field) => (
          <>
            <input data-plan="free" {...radioProps(field, "free", { describedBy: "plans" })} />
            <input data-plan="pro" {...radioProps(field, "pro")} />
          </>
        )}
      </f.Field>
    ));
    const free = get(host, "[data-plan=free]");
    const pro = get(host, "[data-plan=pro]");
    expect(free.type).toBe("radio");
    expect(free.name).toBe("plan");
    expect(free.getAttribute("aria-describedby")).toBe("plans");
    expect(pro.hasAttribute("aria-describedby")).toBe(false);
    expect(free.checked || pro.checked).toBe(false);
    click(pro);
    await settle();
    expect(form.root.at("plan").peek().value).toBe("pro");
    expect(pro.checked).toBe(true);

    form.root.at("plan").setReadOnly(true);
    await settle();
    expect(free.getAttribute("aria-readonly")).toBe("true");
    click(free);
    await settle();
    expect(form.root.at("plan").peek().value).toBe("pro");
    expect(free.checked).toBe(false);
    expect(pro.checked).toBe(true);

    form.root.at("plan").setDisabled(true);
    await settle();
    expect(free.disabled && pro.disabled).toBe(true);
  });
});

describe("selectProps", () => {
  it("writes the chosen option, and doesn't while read-only", async () => {
    const { form, host } = mountSurvey((f) => (
      <select {...selectProps(createField(f.root.at("color")), { empty: "red", describedBy: "colors" })}>
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="blue">Blue</option>
      </select>
    ));
    const select = getAs(host, "select", HTMLSelectElement);
    expect(select.value).toBe("red");
    expect(select.getAttribute("aria-describedby")).toBe("colors");
    choose(select, "green");
    await settle();
    expect(form.root.at("color").peek().value).toBe("green");
    form.root.at("color").setValue("blue");
    await settle();
    expect(select.value).toBe("blue");

    form.root.at("color").setReadOnly(true);
    form.root.at("color").setDisabled(true);
    await settle();
    expect(select.getAttribute("aria-readonly")).toBe("true");
    expect(select.disabled).toBe(true);
    choose(select, "red");
    await settle();
    expect(form.root.at("color").peek().value).toBe("blue");
    expect(select.value).toBe("blue");
  });

  it("writes `empty` for the option whose value is empty", async () => {
    const { form, host } = mountSurvey((f) => (
      <select {...selectProps(createField(f.root.at("plan")))}>
        <option value="">Pick one</option>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>
    ));
    const select = getAs(host, "select", HTMLSelectElement);
    choose(select, "pro");
    await settle();
    expect(form.root.at("plan").peek().value).toBe("pro");
    choose(select, "");
    await settle();
    expect(form.root.at("plan").peek().value).toBeUndefined();
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
    validate: { fields: fieldValidators({ size: (value: string) => (value === "" ? { message: "Required" } : undefined) }) },
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
      const size = createField(f.root.at("size"));
      const picks = createField(f.root.at("picks"));
      const small = radioProps(size, "s");
      const large = radioProps(size, "m l");
      const keyed = checkboxGroupProps(picks, "k0");
      const plain = checkboxGroupProps(picks, "a");
      const first = inputProps(createField(f.root.at("picks").item("k0")));
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
    expect(get(host, '[data-size="m l"]').getAttribute("aria-invalid")).toBe("true");
    expect(host.querySelector(`[id="${errorId(size)}"]`)?.textContent).toBe("size errors");
    expect(document.activeElement).toBe(get(host, '[data-size="s"]'));
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
});
