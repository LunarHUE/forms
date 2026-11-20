import { act, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { errorId as coreErrorId } from "@lunarhue/forms-core";
import {
  checkboxGroupProps,
  checkboxProps,
  createForms,
  errorId,
  type FormOf,
  inputProps,
  numberPieces,
  numberProps,
  optionId,
  radioProps,
  rangeProps,
  selectProps,
  textareaProps,
  useField,
  useForm,
} from "./index.js";

interface Settings {
  title: string;
  bio: string;
  age: number | undefined;
  volume: number;
  newsletter: boolean;
  tags: string[];
  plan: "free" | "pro";
  country: string;
}
const initial: Settings = {
  title: "hello",
  bio: "one two",
  age: undefined,
  volume: 5,
  newsletter: false,
  tags: [],
  plan: "free",
  country: "",
};
const forms = createForms();
const settings = forms.define({ defaultValues: initial });

type SettingsForm = FormOf<typeof settings>;
const holder: { form?: SettingsForm } = {};
const current = (): SettingsForm => {
  if (holder.form === undefined) throw new Error("no form rendered");
  return holder.form;
};
const values = () => current().root.peek().value;

function Settings() {
  const form = useForm(settings, { id: "settings" });
  useEffect(() => {
    holder.form = form;
  });
  const root = form.root;
  const tags = useField(root.at("tags"));
  const plan = useField(root.at("plan"));
  return (
    <>
      <input aria-label="title" {...inputProps(useField(root.at("title")))} />
      <textarea aria-label="bio" {...textareaProps(useField(root.at("bio")))} />
      <input aria-label="age" {...numberProps(useField(root.at("age")))} />
      <input aria-label="volume" {...rangeProps(useField(root.at("volume")))} />
      <input aria-label="newsletter" {...checkboxProps(useField(root.at("newsletter")))} />
      <input aria-label="urgent" {...checkboxGroupProps(tags, "urgent")} />
      <input aria-label="later" {...checkboxGroupProps(tags, "later")} />
      <input aria-label="free" {...radioProps(plan, "free")} />
      <input aria-label="pro" {...radioProps(plan, "pro")} />
      <select aria-label="country" {...selectProps(useField(root.at("country")), { empty: "" })}>
        <option value="">Pick one</option>
        <option value="se">Sweden</option>
        <option value="no">Norway</option>
      </select>
    </>
  );
}

// jsdom clears text such as `1.` from a number input. A text input stands in
// for a browser that reports the text as typed.
function RawAge() {
  const form = useForm(settings);
  useEffect(() => {
    holder.form = form;
  });
  return <input aria-label="raw age" {...numberProps(useField(form.root.at("age")))} type="text" />;
}

function Email() {
  const form = useForm(settings);
  return <input aria-label="email" {...inputProps(useField(form.root.at("title")), { type: "email" })} />;
}

const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);

describe("text and textarea", () => {
  it("keeps the caret after an edit in the middle", async () => {
    render(<Settings />);
    const user = userEvent.setup();
    const title = input("title");
    await user.type(title, "X", { initialSelectionStart: 2, initialSelectionEnd: 2 });
    expect(title.value).toBe("heXllo");
    expect(title.selectionStart).toBe(3);
    await user.keyboard("YZ");
    expect(title.value).toBe("heXYZllo");
    expect(title.selectionStart).toBe(5);
    expect(values().title).toBe("heXYZllo");

    const bio = screen.getByLabelText<HTMLTextAreaElement>("bio");
    await user.type(bio, "and ", { initialSelectionStart: 4, initialSelectionEnd: 4 });
    expect(bio.value).toBe("one and two");
    expect(bio.selectionStart).toBe(8);
    expect(values().bio).toBe("one and two");
  });

  it("names, ids and error links", async () => {
    render(<Settings />);
    const title = input("title");
    expect(title.name).toBe("title");
    expect(title.id).toBe("settings--title");
    expect(title.hasAttribute("aria-invalid")).toBe(false);
    expect(title.getAttribute("aria-describedby")).toBeNull();
    act(() => {
      current().root.at("title").setErrors({ message: "taken" });
      current().root.at("title").setTouched();
    });
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(title.getAttribute("aria-describedby")).toBe(errorId(current().root.at("title")));
    expect(input("pro").id).toBe(optionId("settings--plan", "pro"));
  });

  it("writes type on text inputs only, and ARIA states only while they are on", () => {
    render(<Settings />);
    const bio = screen.getByLabelText("bio");
    const country = screen.getByLabelText("country");
    expect(input("title").getAttribute("type")).toBe("text");
    expect(bio.hasAttribute("type")).toBe(false);
    expect(country.hasAttribute("type")).toBe(false);
    const all = [input("title"), bio, input("age"), input("newsletter"), input("urgent"), input("pro"), country];
    for (const element of all) {
      expect(element.hasAttribute("aria-invalid")).toBe(false);
      expect(element.hasAttribute("aria-readonly")).toBe(false);
    }
    act(() => current().root.setReadOnly(true));
    for (const element of [input("newsletter"), input("urgent"), input("pro"), country]) {
      expect(element.getAttribute("aria-readonly")).toBe("true");
    }
  });

  it("takes the type of a text input from the options", () => {
    render(<Email />);
    expect(input("email").type).toBe("email");
  });
});

const picker = forms.define({ defaultValues: { size: "s", picks: ["a"] as string[] } });
const pickHolder: { form?: FormOf<typeof picker> } = {};
const picked = () => {
  if (pickHolder.form === undefined) throw new Error("no form rendered");
  return pickHolder.form;
};

// A radio group, a checkbox group over an array, and the array's first item,
// whose key is `k0`, as its own input. The group has an option named `k0` too.
function Picker() {
  const form = useForm(picker, { id: "pick" });
  useEffect(() => {
    pickHolder.form = form;
  });
  const size = form.root.at("size");
  const picks = form.root.at("picks");
  const sizeField = useField(size);
  const picksField = useField(picks);
  const small = radioProps(sizeField, "s");
  const large = radioProps(sizeField, "m l");
  const keyed = checkboxGroupProps(picksField, "k0");
  const plain = checkboxGroupProps(picksField, "a");
  const first = inputProps(useField(picks.item("k0")));
  return (
    <>
      <label htmlFor={small.id}>small</label>
      <input {...small} />
      <label htmlFor={large.id}>large</label>
      <input {...large} />
      <label htmlFor={keyed.id}>keyed</label>
      <input {...keyed} />
      <label htmlFor={plain.id}>plain</label>
      <input {...plain} />
      <label htmlFor={first.id}>first pick</label>
      <input {...first} />
      <p id={errorId(size)}>size errors</p>
    </>
  );
}

describe("ids", () => {
  it("gives each option of a radio or checkbox group its own id", () => {
    render(<Picker />);
    expect(input("small").id).toBe("pick--size---option-s");
    expect(input("large").id).toBe("pick--size---option-m_20_l");
    expect(input("large").value).toBe("m l");
    expect(input("keyed").id).toBe("pick--picks---option-k0");
    expect(input("plain").value).toBe("a");
    expect(input("first pick").id).toBe("pick--picks--k0");
    expect(input("first pick").value).toBe("a");
  });

  it("renders no duplicate ids, with array items next to a group over the array", () => {
    const { container } = render(<Picker />);
    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points aria-describedby at core's error id", () => {
    render(<Picker />);
    const size = picked().root.at("size");
    act(() => {
      size.setErrors({ message: "pick one" });
      size.setTouched();
    });
    expect(errorId(size)).toBe(coreErrorId(size.id));
    expect(errorId(size)).toBe("pick--size---error");
    expect(input("small").getAttribute("aria-describedby")).toBe(errorId(size));
    expect(document.getElementById(errorId(size))?.textContent).toBe("size errors");
  });
});

describe("number and range", () => {
  it("keeps partial text in the input while it is not a number", async () => {
    render(<Settings />);
    const user = userEvent.setup();
    const age = input("age");
    expect(age.value).toBe("");
    await user.type(age, "-");
    expect(values().age).toBeUndefined();
    await user.type(age, "4");
    expect(values().age).toBe(-4);
    await user.clear(age);
    expect(values().age).toBeUndefined();
    await user.type(age, "1.");
    expect(values().age).toBe(1);
    await user.type(age, "5");
    expect(values().age).toBe(1.5);
    expect(age.value).toBe("1.5");
  });

  it("keeps the typed text where the browser reports it raw", async () => {
    render(<RawAge />);
    const user = userEvent.setup();
    const age = input("raw age");
    await user.type(age, "-");
    expect(age.value).toBe("-");
    expect(values().age).toBeUndefined();
    await user.type(age, "1.");
    expect(age.value).toBe("-1.");
    expect(values().age).toBe(-1);
    await user.type(age, "0");
    expect(age.value).toBe("-1.0");
    expect(values().age).toBe(-1);
    await user.type(age, "5");
    expect(values().age).toBe(-1.05);
    await user.type(age, "{Backspace}{Backspace}");
    expect(age.value).toBe("-1.");
    await user.tab();
    expect(age.value).toBe("-1");
  });

  it("shows the recorded text, then the number after blur", () => {
    render(<Settings />);
    const age = input("age");
    // A browser that reports the raw text, as Firefox does for `1.`.
    fireEvent.change(age, { target: { value: "12" } });
    expect(values().age).toBe(12);
    fireEvent.blur(age);
    act(() => current().root.at("age").setValue(3));
    expect(age.value).toBe("3");
    fireEvent.change(age, { target: { value: "" } });
    expect(values().age).toBeUndefined();
  });

  it("leaves the stored value while the text isn't a number yet", () => {
    render(<Settings />);
    const age = input("age");
    act(() => current().root.at("age").setValue(3));
    // jsdom never sets `badInput`. A browser sets it for text such as `-` and reports an empty value.
    Object.defineProperty(age, "validity", { configurable: true, value: { badInput: true } });
    fireEvent.change(age, { target: { value: "" } });
    expect(values().age).toBe(3);
    expect(age.value).toBe("");

    Reflect.deleteProperty(age, "validity");
    fireEvent.change(age, { target: { value: "4" } });
    expect(values().age).toBe(4);
    fireEvent.change(age, { target: { value: "" } });
    expect(values().age).toBeUndefined();
  });

  it("writes a range's number", () => {
    render(<Settings />);
    const volume = input("volume");
    expect(volume.type).toBe("range");
    fireEvent.change(volume, { target: { value: "7" } });
    expect(values().volume).toBe(7);
  });
});

describe("checkboxes, radios and selects", () => {
  it("writes a boolean checkbox", async () => {
    render(<Settings />);
    const user = userEvent.setup();
    await user.click(input("newsletter"));
    expect(values().newsletter).toBe(true);
    expect(input("newsletter").checked).toBe(true);
    await user.click(input("newsletter"));
    expect(values().newsletter).toBe(false);
  });

  it("adds and removes options in a checkbox group", async () => {
    render(<Settings />);
    const user = userEvent.setup();
    await user.click(input("urgent"));
    await user.click(input("later"));
    expect(values().tags).toEqual(["urgent", "later"]);
    expect(input("urgent").checked).toBe(true);
    expect(input("urgent").value).toBe("urgent");
    await user.click(input("urgent"));
    expect(values().tags).toEqual(["later"]);
    expect(input("urgent").checked).toBe(false);
  });

  it("writes the chosen radio and select option", async () => {
    render(<Settings />);
    const user = userEvent.setup();
    expect(input("free").checked).toBe(true);
    await user.click(input("pro"));
    expect(values().plan).toBe("pro");
    expect(input("free").checked).toBe(false);
    expect(input("pro").name).toBe("plan");
    await user.selectOptions(screen.getByLabelText("country"), "se");
    expect(values().country).toBe("se");
    await user.selectOptions(screen.getByLabelText("country"), "");
    expect(values().country).toBe("");
  });

  it("writes nothing while read-only", async () => {
    render(<Settings />);
    const user = userEvent.setup();
    act(() => current().root.setReadOnly(true));
    expect(input("newsletter").getAttribute("aria-readonly")).toBe("true");
    expect(input("title").readOnly).toBe(true);
    await user.click(input("newsletter"));
    await user.click(input("urgent"));
    await user.click(input("pro"));
    await user.selectOptions(screen.getByLabelText("country"), "no");
    expect(values()).toMatchObject({ newsletter: false, tags: [], plan: "free", country: "" });
    expect(input("newsletter").checked).toBe(false);
    expect(input("urgent").checked).toBe(false);
    expect(input("free").checked).toBe(true);
    expect(screen.getByLabelText<HTMLSelectElement>("country").value).toBe("");
  });

  it("disables the element with the field", () => {
    render(<Settings />);
    act(() => current().root.at("plan").setDisabled(true));
    expect(input("free").disabled).toBe(true);
    expect(input("title").disabled).toBe(false);
  });
});

const elements = () => [
  input("title"),
  screen.getByLabelText<HTMLTextAreaElement>("bio"),
  input("age"),
  input("volume"),
  input("newsletter"),
  input("urgent"),
  input("pro"),
  screen.getByLabelText<HTMLSelectElement>("country"),
];
const names = ["title", "bio", "age", "volume", "newsletter", "tags", "plan", "country"] as const;

describe("every kind", () => {
  it("points aria at the errors once they show", () => {
    render(<Settings />);
    for (const element of elements()) expect(element.hasAttribute("aria-invalid")).toBe(false);
    act(() => {
      for (const name of names) {
        current().root.at(name).setErrors({ message: "wrong" });
        current().root.at(name).setTouched();
      }
    });
    elements().forEach((element, index) => {
      expect(element.getAttribute("aria-invalid")).toBe("true");
      expect(element.getAttribute("aria-describedby")).toBe(errorId(current().root.at(names[index] ?? "title")));
    });
  });

  it("disables every element with its field", () => {
    render(<Settings />);
    act(() => current().root.setDisabled(true));
    for (const element of elements()) expect(element.disabled).toBe(true);
  });

  it("marks text, number and range inputs read-only, and number and range write nothing then", () => {
    render(<Settings />);
    act(() => current().root.setReadOnly(true));
    expect(screen.getByLabelText<HTMLTextAreaElement>("bio").readOnly).toBe(true);
    expect(input("age").readOnly).toBe(true);
    expect(input("volume").readOnly).toBe(true);
    fireEvent.change(input("age"), { target: { value: "7" } });
    fireEvent.change(input("volume"), { target: { value: "9" } });
    expect(values()).toMatchObject({ age: undefined, volume: 5 });
  });
});

const extras = forms.define({ defaultValues: { count: 3, size: undefined as "s" | "l" | undefined } });
const extraHolder: { form?: FormOf<typeof extras> } = {};

function Extras() {
  const form = useForm(extras);
  useEffect(() => {
    extraHolder.form = form;
  });
  return (
    <>
      <input aria-label="count" {...numberProps(useField(form.root.at("count")), { empty: 0 })} />
      <select aria-label="size" {...selectProps(useField(form.root.at("size")))}>
        <option value="">Any</option>
        <option value="s">Small</option>
      </select>
    </>
  );
}

const extraValues = () => extraHolder.form?.root.peek().value;

describe("the empty option", () => {
  it("is what an empty number input or the select's empty option writes", async () => {
    render(<Extras />);
    fireEvent.change(input("count"), { target: { value: "" } });
    expect(extraValues()?.count).toBe(0);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("size"), "s");
    expect(extraValues()?.size).toBe("s");
    await user.selectOptions(screen.getByLabelText("size"), "");
    expect(extraValues()?.size).toBeUndefined();
  });
});

interface Rendered {
  readonly title: ReturnType<typeof inputProps>;
  readonly age: ReturnType<typeof numberProps>;
  readonly pro: ReturnType<typeof radioProps>;
  readonly urgent: ReturnType<typeof checkboxGroupProps>;
  readonly pieces: ReturnType<typeof numberPieces>;
}
const rendered: Rendered[] = [];

// Renders on every change to the form, through a field it doesn't bind, so a
// render where the bound fields didn't change shows whether their props stayed.
function Identity() {
  const form = useForm(settings);
  useEffect(() => {
    holder.form = form;
  });
  const root = form.root;
  useField(root.at("country"));
  const age = useField(root.at("age"));
  const props = {
    title: inputProps(useField(root.at("title"))),
    age: numberProps(age),
    pro: radioProps(useField(root.at("plan")), "pro"),
    urgent: checkboxGroupProps(useField(root.at("tags")), "urgent"),
    pieces: numberPieces(age),
  };
  rendered.push(props);
  return (
    <>
      <input aria-label="title" {...props.title} />
      <input aria-label="age" {...props.age} />
    </>
  );
}

const last = (): Rendered => {
  const props = rendered[rendered.length - 1];
  if (props === undefined) throw new Error("not rendered");
  return props;
};
const mount = (): Rendered => {
  rendered.length = 0;
  render(<Identity />);
  return last();
};

describe("identity", () => {
  it("keeps the props while their field doesn't change", () => {
    const before = mount();
    const renders = rendered.length;
    act(() => current().root.at("country").setValue("se"));
    expect(rendered.length).toBeGreaterThan(renders);
    for (const key of ["title", "age", "pro", "urgent", "pieces"] as const) expect(last()[key]).toBe(before[key]);
  });

  it("gives new props when the field changes, with the same callbacks", () => {
    const before = mount();
    act(() => current().root.at("title").setValue("changed"));
    expect(last().title).not.toBe(before.title);
    expect(last().title.onChange).toBe(before.title.onChange);
    expect(last().title.onBlur).toBe(before.title.onBlur);
    expect(last().title.ref).toBe(before.title.ref);
    expect(last().age).toBe(before.age);
  });

  it("gives new number props and pieces when the typed text changes, with the same callbacks", () => {
    const before = mount();
    fireEvent.change(input("age"), { target: { value: "12" } });
    expect(values().age).toBe(12);
    expect(last().age).not.toBe(before.age);
    expect(last().age.onChange).toBe(before.age.onChange);
    expect(last().age.onBlur).toBe(before.age.onBlur);
    expect(last().pieces).not.toBe(before.pieces);
    expect(last().pieces.setText).toBe(before.pieces.setText);
    expect(last().pieces.handleBlur).toBe(before.pieces.handleBlur);
    expect(last().pieces.text).toBe("12");
  });
});

function Title() {
  const form = useForm(settings);
  useEffect(() => {
    holder.form = form;
  });
  const title = useField(form.root.at("title"));
  return <p>{`${title.value} ${title.touched}`}</p>;
}

describe("useField(handle)", () => {
  it("returns the field object form.Field gives its children", () => {
    const hooked: unknown[] = [];
    const given: unknown[] = [];
    function Both() {
      const form = useForm(settings);
      const title = form.root.at("title");
      const field = useField(title);
      hooked.push(field);
      expect(field.handle).toBe(title);
      expect(field.setValue).toBeTypeOf("function");
      return (
        <form.Field handle={title}>
          {(child) => {
            given.push(child);
            return <p>{child.value}</p>;
          }}
        </form.Field>
      );
    }
    render(<Both />);
    expect(given).toHaveLength(1);
    expect(given[0]).toBe(hooked[hooked.length - 1]);
  });

  it("re-renders when the field changes", () => {
    render(<Title />);
    expect(screen.getByText("hello false")).toBeTruthy();
    act(() => current().root.at("title").setValue("bye"));
    expect(screen.getByText("bye false")).toBeTruthy();
    act(() => current().root.at("title").setTouched());
    expect(screen.getByText("bye true")).toBeTruthy();
  });
});
