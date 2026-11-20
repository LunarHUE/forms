import { describe, expectTypeOf, it } from "vitest";
import {
  type CheckboxGroupInputProps,
  checkboxGroupProps,
  type CheckboxInputProps,
  checkboxProps,
  createField,
  createForms,
  type ExactFieldApi,
  type FieldApi,
  inputProps,
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
} from "./index.js";

function Text(props: { readonly name: ExactFieldApi<string>; readonly bio: ExactFieldApi<string | undefined> }) {
  expectTypeOf(inputProps(props.name)).toEqualTypeOf<TextInputProps>();
  expectTypeOf(textareaProps(props.bio, { describedBy: "hint" })).toEqualTypeOf<TextareaProps>();
  // @ts-expect-error: a text input's type holds a string
  inputProps(props.name, { type: "number" });
  return (
    <>
      <input {...inputProps(props.name, { type: "email", describedBy: "hint" })} />
      <textarea {...textareaProps(props.bio)} />
    </>
  );
}

function Numbers(props: { readonly draft: FieldApi<number>; readonly plain: ExactFieldApi<number> }) {
  expectTypeOf(numberProps(props.draft)).toEqualTypeOf<NumberInputProps>();
  expectTypeOf(numberProps(props.plain, { empty: 0, describedBy: "unit" })).toEqualTypeOf<NumberInputProps>();
  expectTypeOf(rangeProps(props.plain)).toEqualTypeOf<RangeInputProps>();
  expectTypeOf(numberPieces(props.draft)).toEqualTypeOf<NumberPieces>();
  expectTypeOf(numberPieces(props.plain, { empty: 0 })).toEqualTypeOf<NumberPieces>();
  // @ts-expect-error: an empty input needs a number to write, since undefined is not allowed
  numberProps(props.plain);
  // @ts-expect-error: the same holds for the pieces
  numberPieces(props.plain);
  // @ts-expect-error: empty is a number
  numberProps(props.plain, { empty: "" });
  // @ts-expect-error: the pieces set no aria, so they take no describedBy
  numberPieces(props.draft, { describedBy: "unit" });
  return (
    <>
      <input {...numberProps(props.draft)} />
      <input {...rangeProps(props.plain, { describedBy: "unit" })} min={0} max={10} />
    </>
  );
}

function Choices(props: {
  readonly newsletter: ExactFieldApi<boolean>;
  readonly tags: ExactFieldApi<string[]>;
  readonly plan: ExactFieldApi<"free" | "pro">;
  readonly country: ExactFieldApi<string>;
  readonly size: FieldApi<"s" | "l">;
}) {
  expectTypeOf(checkboxProps(props.newsletter)).toEqualTypeOf<CheckboxInputProps>();
  expectTypeOf(checkboxGroupProps(props.tags, "urgent", { describedBy: "hint" })).toEqualTypeOf<CheckboxGroupInputProps>();
  expectTypeOf(radioProps(props.plan, "free", { describedBy: "hint" })).toEqualTypeOf<RadioInputProps>();
  expectTypeOf(selectProps(props.country, { empty: "" })).toEqualTypeOf<SelectProps>();
  expectTypeOf(selectProps(props.size, { describedBy: "hint" })).toEqualTypeOf<SelectProps>();
  // @ts-expect-error: a group box needs its option
  checkboxGroupProps(props.tags);
  // @ts-expect-error: the array holds strings
  checkboxGroupProps(props.tags, 1);
  // @ts-expect-error: not one of the plan's options
  radioProps(props.plan, "team");
  // @ts-expect-error: the empty option needs a string to write, since undefined is not allowed
  selectProps(props.country);
  return (
    <>
      <input {...checkboxProps(props.newsletter)} />
      <input {...radioProps(props.plan, "pro")} />
      <select {...selectProps(props.size)} />
    </>
  );
}

const store = createForms().define({ defaultValues: { address: { city: "" }, flags: [true] } }).createStore();

// Each function binds the value types it names, and rejects the others.
function WrongTypes(props: {
  readonly age: ExactFieldApi<number>;
  readonly name: ExactFieldApi<string>;
  readonly newsletter: ExactFieldApi<boolean>;
  readonly tags: ExactFieldApi<string[]>;
}) {
  const { age, name, newsletter, tags } = props;
  const address = createField(store.root.at("address"));
  const flags = createField(store.root.at("flags"));
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

describe("props functions", () => {
  it("bind the value types they name, as components", () => {
    for (const component of [Text, Numbers, Choices, WrongTypes]) expectTypeOf(component).toBeFunction();
  });
});
