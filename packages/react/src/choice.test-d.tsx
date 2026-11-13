import { describe, expectTypeOf, it } from "vitest";
import type { ReactNode } from "react";
import {
  type Choice,
  createForms,
  type FieldApi,
  type SchemaPlugin,
  type StandardSchemaV1,
  useForm,
  type ValueOf,
} from "./index.js";

interface FakeSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly fake: true;
}
declare const fakePlugin: SchemaPlugin<FakeSchema<unknown>>;

interface Option<T> {
  readonly value: T;
  readonly label: string;
}

// Option components written once with `Choice`, each calling `inputProps` itself.
function SelectField(props: {
  readonly field: FieldApi<Choice>;
  readonly label: string;
  readonly options: readonly Option<Choice>[];
  readonly onPick?: (value: Choice) => void;
  readonly children?: ReactNode;
}) {
  const { field } = props;
  expectTypeOf(field.value).toEqualTypeOf<Choice | undefined>();
  return (
    <select {...field.inputProps({ kind: "select" })} aria-label={props.label}>
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function RadioGroupField(props: { readonly field: FieldApi<Choice>; readonly options: readonly Option<Choice>[] }) {
  const { field } = props;
  return (
    <>
      {props.options.map((option) => (
        <input key={option.value} {...field.inputProps({ kind: "radio", value: option.value })} />
      ))}
      <button type="button" onClick={() => field.setValue(props.options[0]?.value)}>
        First
      </button>
    </>
  );
}

function CheckboxGroupField(props: { readonly field: FieldApi<Choice[]>; readonly options: readonly Option<Choice>[] }) {
  const { field } = props;
  expectTypeOf(field.value).toEqualTypeOf<readonly Choice[]>();
  return (
    <>
      {props.options.map((option) => (
        <input key={option.value} {...field.inputProps({ kind: "checkbox", value: option.value })} />
      ))}
    </>
  );
}

function SizeField(props: { readonly field: FieldApi<Choice<number>>; readonly sizes: readonly Choice<number>[] }) {
  const { field } = props;
  return (
    <>
      {props.sizes.map((size) => (
        <input key={size} {...field.inputProps({ kind: "radio", value: size })} />
      ))}
    </>
  );
}

function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  return <input {...props.field.inputProps()} aria-label={props.label} />;
}

const forms = createForms({
  plugins: [fakePlugin],
  fields: { SelectField, RadioGroupField, CheckboxGroupField, SizeField, TextField },
});

interface Profile {
  country: "GB" | "IE";
  name: string;
  size: 1 | 2;
  channels: ("email" | "sms")[];
  subscribed: boolean;
  age: number;
}
declare const profileSchema: FakeSchema<Profile>;
const profile = forms.define({ schema: profileSchema });
const plainStart: { country: "GB" | "IE" } = { country: "GB" };
const plain = forms.define({ defaultValues: plainStart });

const countries = [
  { value: "GB", label: "United Kingdom" },
  { value: "IE", label: "Ireland" },
] as const;

// Stands for the field's options.
function RightUses() {
  const form = useForm(profile);
  return (
    <>
      <form.SelectField name="country" label="Country" options={countries} />
      <form.SelectField
        name="country"
        label="Country"
        options={[{ value: "GB", label: "United Kingdom" }]}
        onPick={(value) => expectTypeOf(value).toEqualTypeOf<"GB" | "IE">()}
      />
      <form.RadioGroupField name="country" options={countries} />
      <form.SelectField name="name" label="Name" options={[{ value: "anything", label: "Anything" }]} />
      <form.CheckboxGroupField name="channels" options={[{ value: "sms", label: "SMS" }]} />
      <form.SizeField name="size" sizes={[1, 2]} />
      <form.SelectField handle={form.root.at("country")} label="Country" options={countries} />
      <form.TextField name="name" label="Name" />
    </>
  );
}

// Takes a validate prop typed with the named field's own value.
function ValidateUses() {
  const form = useForm(profile);
  return (
    <>
      <form.SelectField
        name="country"
        label="Country"
        options={countries}
        validate={(value) => (expectTypeOf(value).toEqualTypeOf<"GB" | "IE" | undefined>(), null)}
      />
      <form.CheckboxGroupField
        name="channels"
        options={[{ value: "sms", label: "SMS" }]}
        validate={{ validate: (value) => (expectTypeOf(value).toEqualTypeOf<("email" | "sms")[]>(), null), debounce: 300 }}
      />
      <form.SelectField
        handle={form.root.at("country")}
        label="Country"
        options={countries}
        validate={(value) => (expectTypeOf(value).toEqualTypeOf<"GB" | "IE" | undefined>(), null)}
      />
      <form.RadioGroupField name="country" options={countries} validate={false} />
      {/* @ts-expect-error: country holds its options, not numbers */}
      <form.SelectField name="country" label="Country" options={countries} validate={(value: number) => (value > 0 ? null : { message: "No" })} />
      {/* @ts-expect-error: channels is an array */}
      <form.CheckboxGroupField name="channels" options={[]} validate={(value: string) => (value === "" ? null : { message: "No" })} />
    </>
  );
}

// A registered option component that declares a validate prop of its own.
function OwnValidateSelect(props: {
  readonly field: FieldApi<Choice>;
  readonly options: readonly Option<Choice>[];
  readonly validate?: boolean;
}) {
  return <select {...props.field.inputProps({ kind: "select" })} data-validate={props.validate} />;
}

// Fits a plain form's field with no undefined.
function PlainUses() {
  const form = useForm(plain);
  expectTypeOf<ValueOf<typeof form.root>>().toEqualTypeOf<{ country: "GB" | "IE" }>();
  return <form.SelectField name="country" label="Country" options={countries} />;
}

// Rejects options and fields that don't fit.
function WrongUses() {
  const form = useForm(profile);
  return (
    <>
      {/* @ts-expect-error: FR is not one of the country options */}
      <form.SelectField name="country" label="Country" options={[{ value: "FR", label: "France" }]} />
      {/* @ts-expect-error: the callback gets the field's options, not any string */}
      <form.SelectField name="country" label="Country" options={countries} onPick={(value: number) => value} />
      {/* @ts-expect-error: subscribed is a boolean */}
      <form.SelectField name="subscribed" label="Subscribed" options={[]} />
      {/* @ts-expect-error: size holds numbers, SelectField strings */}
      <form.SelectField name="size" label="Size" options={[]} />
      {/* @ts-expect-error: channels is an array, RadioGroupField takes one value */}
      <form.RadioGroupField name="channels" options={[]} />
      {/* @ts-expect-error: country is not an array */}
      <form.CheckboxGroupField name="country" options={[]} />
      {/* @ts-expect-error: push is not a channel */}
      <form.CheckboxGroupField name="channels" options={[{ value: "push", label: "Push" }]} />
      {/* @ts-expect-error: 3 is not a size */}
      <form.SizeField name="size" sizes={[3]} />
      {/* @ts-expect-error: age is a number, SelectField takes strings */}
      <form.SelectField name="age" label="Age" options={[]} />
      {/* @ts-expect-error: the handle's field is a boolean */}
      <form.SelectField handle={form.root.at("subscribed")} label="Subscribed" options={[]} />
      {/* @ts-expect-error: the component's own label prop is required */}
      <form.SelectField name="country" options={countries} />
      {/* @ts-expect-error: field is filled in by the form, not passed */}
      <form.SelectField name="country" label="Country" options={countries} field={undefined} />
    </>
  );
}

// Leaves the checks of other components as they are.
function OtherUses() {
  const form = useForm(profile);
  return (
    <>
      {/* @ts-expect-error: country is a picklist, TextField edits any string */}
      <form.TextField name="country" label="Country" />
      {/* @ts-expect-error: age is a number */}
      <form.TextField name="age" label="Age" />
    </>
  );
}

describe("Choice", () => {
  it("stands for the field's options", () => {
    expectTypeOf(RightUses).toBeFunction();
  });

  it("takes a validate prop typed with the named field's own value", () => {
    expectTypeOf(ValidateUses).toBeFunction();
  });

  it("rejects a registered option component that declares validate", () => {
    // @ts-expect-error: validate is the bound component's own prop
    createForms({ fields: { OwnValidateSelect } });
    expectTypeOf(createForms({ fields: { SelectField } })).toBeObject();
  });

  it("fits a plain form's field with no undefined", () => {
    expectTypeOf(PlainUses).toBeFunction();
  });

  it("rejects options and fields that don't fit", () => {
    expectTypeOf(WrongUses).toBeFunction();
  });

  it("leaves the checks of other components as they are", () => {
    expectTypeOf(OtherUses).toBeFunction();
  });
});
