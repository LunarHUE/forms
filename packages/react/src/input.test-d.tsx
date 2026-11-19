import { describe, expectTypeOf, it } from "vitest";
import {
  type ArrayHandle,
  type CheckboxGroupInputProps,
  type CheckboxInputProps,
  createForms,
  errorId,
  type FieldApi,
  inputProps,
  type LeafHandle,
  type NumberInputProps,
  type RadioInputProps,
  type SelectProps,
  type TextareaProps,
  type TextInputProps,
  useField,
  useFieldRef,
  useInputProps,
} from "./index.js";

function Text({ name, bio }: { readonly name: LeafHandle<string>; readonly bio: LeafHandle<string | undefined> }) {
  const props = useInputProps(name);
  expectTypeOf(props).toEqualTypeOf<TextInputProps>();
  expectTypeOf(useInputProps(name, { kind: "text" })).toEqualTypeOf<TextInputProps>();
  const bioProps = useInputProps(bio, { kind: "textarea" });
  expectTypeOf(bioProps).toEqualTypeOf<TextareaProps>();
  // @ts-expect-error: a text input's type holds a string
  useInputProps(name, { type: "number" });
  return (
    <>
      <input {...props} />
      <input {...useInputProps(name, { type: "email" })} />
      <textarea {...bioProps} />
    </>
  );
}

function Numbers({ draft, plain }: { readonly draft: LeafHandle<number | undefined>; readonly plain: LeafHandle<number> }) {
  const draftProps = useInputProps(draft, { kind: "number" });
  expectTypeOf(draftProps).toEqualTypeOf<NumberInputProps>();
  const range = useInputProps(plain, { kind: "range", empty: 0 });
  // @ts-expect-error: an empty input needs a number to write, since undefined is not allowed
  useInputProps(plain, { kind: "number" });
  return (
    <>
      <input {...draftProps} />
      <input {...range} min={0} max={10} />
    </>
  );
}

function Checkboxes({ newsletter, tags }: { readonly newsletter: LeafHandle<boolean>; readonly tags: ArrayHandle<string[]> }) {
  const props = useInputProps(newsletter, { kind: "checkbox" });
  expectTypeOf(props).toEqualTypeOf<CheckboxInputProps>();
  const urgent = useInputProps(tags, { kind: "checkbox", value: "urgent" });
  expectTypeOf(urgent).toEqualTypeOf<CheckboxGroupInputProps>();
  // @ts-expect-error: a group box needs its option
  useInputProps(tags, { kind: "checkbox" });
  // @ts-expect-error: the array holds strings
  useInputProps(tags, { kind: "checkbox", value: 1 });
  return (
    <>
      <input {...props} />
      <input {...urgent} />
    </>
  );
}

function Radios({ plan }: { readonly plan: LeafHandle<"free" | "pro"> }) {
  const free = useInputProps(plan, { kind: "radio", value: "free" });
  expectTypeOf(free).toEqualTypeOf<RadioInputProps>();
  // @ts-expect-error: not one of the plan's options
  useInputProps(plan, { kind: "radio", value: "team" });
  return <input {...free} />;
}

function Selects({ country, plan }: { readonly country: LeafHandle<string>; readonly plan: LeafHandle<"free" | "pro" | undefined> }) {
  const props = useInputProps(country, { kind: "select", empty: "" });
  expectTypeOf(props).toEqualTypeOf<SelectProps>();
  // @ts-expect-error: the empty option needs a string to write, since undefined is not allowed
  useInputProps(country, { kind: "select" });
  return (
    <>
      <select {...props}>
        <option value="">Pick one</option>
      </select>
      <select {...useInputProps(plan, { kind: "select" })} />
    </>
  );
}

const addressStore = createForms().define({ defaultValues: { address: { city: "" } } }).createStore();

function WrongKinds({ age, name, newsletter }: { readonly age: LeafHandle<number>; readonly name: LeafHandle<string>; readonly newsletter: LeafHandle<boolean> }) {
  // @ts-expect-error: a text input writes strings, and age is a number
  useInputProps(age);
  // @ts-expect-error: a checkbox writes booleans, and name is a string
  useInputProps(name, { kind: "checkbox" });
  // @ts-expect-error: a number input writes numbers, and newsletter is a boolean
  useInputProps(newsletter, { kind: "number", empty: false });
  // @ts-expect-error: an object field has no input
  useInputProps(addressStore.root.at("address"));
  return <span />;
}

// inputProps(field) has the same checks on a field object.
function FromField({ text, count }: { readonly text: FieldApi<string>; readonly count: FieldApi<number> }) {
  expectTypeOf(inputProps(text)).toEqualTypeOf<TextInputProps>();
  expectTypeOf(inputProps(count, { kind: "number", empty: 0 })).toEqualTypeOf<NumberInputProps>();
  // @ts-expect-error: count is a number, so it needs a kind
  inputProps(count);
  // @ts-expect-error: text is a string
  inputProps(text, { kind: "checkbox" });
  return <input {...inputProps(text)} />;
}

// A custom input records its element for focus and points at its error element itself.
function DatePicker({ born }: { readonly born: LeafHandle<Date | undefined> }) {
  const ref = useFieldRef(born);
  const snapshot = useField(born);
  return (
    <div ref={ref} tabIndex={-1} aria-describedby={snapshot.shownErrors.length > 0 ? errorId(born) : undefined}>
      {snapshot.value?.toDateString()}
    </div>
  );
}

describe("input props check the kind against the value type", () => {
  it("binds text, number, range, checkbox, checkbox group, radio and select", () => {
    expectTypeOf(Text).toBeFunction();
    expectTypeOf(Numbers).toBeFunction();
    expectTypeOf(Checkboxes).toBeFunction();
    expectTypeOf(Radios).toBeFunction();
    expectTypeOf(Selects).toBeFunction();
  });

  it("rejects kinds that don't fit, on the hook and on the field object", () => {
    expectTypeOf(WrongKinds).toBeFunction();
    expectTypeOf(FromField).toBeFunction();
  });

  it("gives custom inputs a ref and an error id", () => {
    expectTypeOf(DatePicker).toBeFunction();
  });
});
