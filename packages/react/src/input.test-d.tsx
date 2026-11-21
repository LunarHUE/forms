import { describe, expectTypeOf, it } from "vitest";
import {
  type NamedArrayHandle,
  type CheckboxGroupInputProps,
  checkboxGroupProps,
  type CheckboxInputProps,
  checkboxProps,
  createForms,
  errorId,
  type ExactFieldApi,
  type FieldApi,
  type FieldApiOf,
  inputProps,
  type NamedLeafHandle,
  type NumberInputProps,
  type NumberPieces,
  numberPieces,
  numberProps,
  type RadioInputProps,
  radioProps,
  type RangeInputProps,
  rangeProps,
  type SelectProps,
  selectProps,
  type TextareaProps,
  textareaProps,
  type TextInputProps,
  useField,
  useFieldRef,
} from "./index.js";

function Text({ name, bio }: { readonly name: NamedLeafHandle<string>; readonly bio: NamedLeafHandle<string | undefined> }) {
  const field = useField(name);
  expectTypeOf(field).toEqualTypeOf<FieldApiOf<NamedLeafHandle<string>>>();
  const props = inputProps(field);
  expectTypeOf(props).toEqualTypeOf<TextInputProps>();
  const bioProps = textareaProps(useField(bio));
  expectTypeOf(bioProps).toEqualTypeOf<TextareaProps>();
  // @ts-expect-error: a text input's type holds a string
  inputProps(field, { type: "number" });
  return (
    <>
      <input {...props} />
      <input {...inputProps(field, { type: "email" })} />
      <textarea {...bioProps} />
    </>
  );
}

function Numbers({ draft, plain }: { readonly draft: NamedLeafHandle<number | undefined>; readonly plain: NamedLeafHandle<number> }) {
  const draftField = useField(draft);
  const plainField = useField(plain);
  const draftProps = numberProps(draftField);
  expectTypeOf(draftProps).toEqualTypeOf<NumberInputProps>();
  expectTypeOf(numberProps(plainField, { empty: 0 })).toEqualTypeOf<NumberInputProps>();
  const range = rangeProps(plainField);
  expectTypeOf(range).toEqualTypeOf<RangeInputProps>();
  expectTypeOf(numberPieces(draftField)).toEqualTypeOf<NumberPieces>();
  // @ts-expect-error: an empty input needs a number to write, since undefined is not allowed
  numberProps(plainField);
  // @ts-expect-error: the same holds for the pieces
  numberPieces(plainField);
  // @ts-expect-error: empty is a number
  numberProps(plainField, { empty: "" });
  return (
    <>
      <input {...draftProps} />
      <input {...range} min={0} max={10} />
    </>
  );
}

function Checkboxes({ newsletter, tags }: { readonly newsletter: NamedLeafHandle<boolean>; readonly tags: NamedArrayHandle<string[]> }) {
  const props = checkboxProps(useField(newsletter));
  expectTypeOf(props).toEqualTypeOf<CheckboxInputProps>();
  const tagsField = useField(tags);
  const urgent = checkboxGroupProps(tagsField, "urgent");
  expectTypeOf(urgent).toEqualTypeOf<CheckboxGroupInputProps>();
  // @ts-expect-error: a group box needs its option
  checkboxGroupProps(tagsField);
  // @ts-expect-error: the array holds strings
  checkboxGroupProps(tagsField, 1);
  return (
    <>
      <input {...props} />
      <input {...urgent} />
    </>
  );
}

function Radios({ plan }: { readonly plan: NamedLeafHandle<"free" | "pro"> }) {
  const field = useField(plan);
  const free = radioProps(field, "free");
  expectTypeOf(free).toEqualTypeOf<RadioInputProps>();
  // @ts-expect-error: not one of the plan's options
  radioProps(field, "team");
  return <input {...free} />;
}

function Selects({ country, plan }: { readonly country: NamedLeafHandle<string>; readonly plan: NamedLeafHandle<"free" | "pro" | undefined> }) {
  const countryField = useField(country);
  const props = selectProps(countryField, { empty: "" });
  expectTypeOf(props).toEqualTypeOf<SelectProps>();
  // @ts-expect-error: the empty option needs a string to write, since undefined is not allowed
  selectProps(countryField);
  return (
    <>
      <select {...props}>
        <option value="">Pick one</option>
      </select>
      <select {...selectProps(useField(plan))} />
    </>
  );
}

const addressStore = createForms().define({ defaultValues: { address: { city: "" }, flags: [true] } }).createStore();

// Each function binds the value types it names, and rejects the others.
function WrongTypes(props: {
  readonly age: ExactFieldApi<number>;
  readonly name: ExactFieldApi<string>;
  readonly newsletter: ExactFieldApi<boolean>;
  readonly tags: ExactFieldApi<string[]>;
}) {
  const { age, name, newsletter, tags } = props;
  const address = useField(addressStore.root.at("address"));
  const flags = useField(addressStore.root.at("flags"));
  // @ts-expect-error: a text input writes strings, and age is a number
  inputProps(age);
  // @ts-expect-error: a textarea writes strings
  textareaProps(newsletter);
  // @ts-expect-error: a select writes strings
  selectProps(age, { empty: 0 });
  // @ts-expect-error: a checkbox writes booleans, and name is a string
  checkboxProps(name);
  // @ts-expect-error: a group box needs an array
  checkboxGroupProps(name, "a");
  // @ts-expect-error: a group box needs an array of strings or numbers
  checkboxGroupProps(flags, true);
  // @ts-expect-error: a radio writes a string, number or boolean
  radioProps(tags, ["a"]);
  // @ts-expect-error: a number input writes numbers, and newsletter is a boolean
  numberProps(newsletter, { empty: false });
  // @ts-expect-error: a range writes numbers
  rangeProps(name);
  // @ts-expect-error: the number pieces write numbers
  numberPieces(name, { empty: "" });
  // @ts-expect-error: an object field has no input
  inputProps(address);
  return <span />;
}

// A registered component's field fits the functions for its value type.
function FromField({ text, count }: { readonly text: FieldApi<string>; readonly count: FieldApi<number> }) {
  expectTypeOf(inputProps(text)).toEqualTypeOf<TextInputProps>();
  expectTypeOf(numberProps(count)).toEqualTypeOf<NumberInputProps>();
  // @ts-expect-error: count is a number
  inputProps(count);
  // @ts-expect-error: text is a string
  checkboxProps(text);
  return <input {...inputProps(text)} />;
}

// A custom input records its element for focus and points at its error element itself.
function DatePicker({ born }: { readonly born: NamedLeafHandle<Date | undefined> }) {
  const ref = useFieldRef(born);
  const field = useField(born);
  return (
    <div ref={ref} tabIndex={-1} aria-describedby={field.shownErrors.length > 0 ? errorId(born) : undefined}>
      {field.value?.toDateString()}
    </div>
  );
}

// `useField` with a selector returns what it picks from the snapshot.
function Selected({ name }: { readonly name: NamedLeafHandle<string> }) {
  const length = useField(name, (snapshot) => snapshot.value.length);
  expectTypeOf(length).toEqualTypeOf<number>();
  return <span>{length}</span>;
}

describe("the props functions check the field's value type", () => {
  it("binds text, textarea, number, range, checkbox, checkbox group, radio and select", () => {
    expectTypeOf(Text).toBeFunction();
    expectTypeOf(Numbers).toBeFunction();
    expectTypeOf(Checkboxes).toBeFunction();
    expectTypeOf(Radios).toBeFunction();
    expectTypeOf(Selects).toBeFunction();
  });

  it("rejects fields of other value types", () => {
    expectTypeOf(WrongTypes).toBeFunction();
    expectTypeOf(FromField).toBeFunction();
  });

  it("gives custom inputs a ref and an error id", () => {
    expectTypeOf(DatePicker).toBeFunction();
    expectTypeOf(Selected).toBeFunction();
  });
});
