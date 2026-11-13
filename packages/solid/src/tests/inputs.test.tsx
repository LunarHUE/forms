import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createForms, createInputProps, errorId, fieldRef } from "../index.js";
import { choose, click, get, getAs, mount, settle, typeText } from "./dom.js";

const forms = createForms({ schemas: [valibot()] });
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
type SurveyForm = ReturnType<typeof Survey.createForm>;

/** Mounts a form and returns it with the host element. */
function mountSurvey(render: (form: SurveyForm) => ReturnType<SurveyForm["Form"]>) {
  let form: SurveyForm | undefined;
  const { host } = mount(() => {
    form = Survey.createForm({ id: "survey" });
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
            <input {...field.inputProps({ type: "email", describedBy: "hint" })} />
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
    const { form, host } = mountSurvey((f) => <f.Field name="age">{(field) => <input {...field.inputProps({ kind: "number" })} />}</f.Field>);
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
            <input data-tag="news" {...field.inputProps({ kind: "checkbox", value: "news" })} />
            <input data-tag="offers" {...field.inputProps({ kind: "checkbox", value: "offers" })} />
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
    let form: ReturnType<typeof Sizes.createForm> | undefined;
    const { host } = mount(() => {
      form = Sizes.createForm();
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
            <input data-plan="free" {...field.inputProps({ kind: "radio", value: "free" })} />
            <input data-plan="pro" {...field.inputProps({ kind: "radio", value: "pro" })} />
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
          same = field.inputProps() === field.inputProps({ kind: "text" }) && field.inputProps() !== field.inputProps({ type: "email" });
          return null;
        }}
      </f.Field>
    ));
    expect(same).toBe(true);
  });
});
