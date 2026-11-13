import { valibot } from "@lunarhue/forms-schema/valibot";
import { For } from "solid-js";
import * as v from "valibot";
import { describe, expectTypeOf, it } from "vitest";
import { type Choice, createForm, createForms, type FieldApi } from "./index.js";

interface Option<T> {
  readonly value: T;
  readonly label: string;
}

// Option components written once with `Choice`, each calling `inputProps` itself.
function SelectField(props: {
  field: FieldApi<Choice>;
  label: string;
  options: readonly Option<Choice>[];
  onPick?: (value: Choice) => void;
}) {
  expectTypeOf(props.field.value).toEqualTypeOf<Choice | undefined>();
  return (
    <select {...props.field.inputProps({ kind: "select" })} aria-label={props.label}>
      <For each={props.options}>{(option) => <option value={option.value}>{option.label}</option>}</For>
    </select>
  );
}

function RadioGroupField(props: { field: FieldApi<Choice>; options: readonly Option<Choice>[] }) {
  return (
    <>
      <For each={props.options}>
        {(option) => <input {...props.field.inputProps({ kind: "radio", value: option.value })} />}
      </For>
      <button type="button" onClick={() => props.field.setValue(props.options[0]?.value)}>
        First
      </button>
    </>
  );
}

function CheckboxGroupField(props: { field: FieldApi<Choice[]>; options: readonly Option<Choice>[] }) {
  return (
    <For each={props.options}>
      {(option) => <input {...props.field.inputProps({ kind: "checkbox", value: option.value })} />}
    </For>
  );
}

function SizeField(props: { field: FieldApi<Choice<number>>; sizes: readonly Choice<number>[] }) {
  return <For each={props.sizes}>{(size) => <input {...props.field.inputProps({ kind: "radio", value: size })} />}</For>;
}

function TextField(props: { field: FieldApi<string>; label: string }) {
  return <input {...props.field.inputProps()} aria-label={props.label} />;
}

const forms = createForms({
  schemas: [valibot()],
  fields: { SelectField, RadioGroupField, CheckboxGroupField, SizeField, TextField },
});

const profile = forms.define({
  schema: v.object({
    country: v.picklist(["GB", "IE"]),
    name: v.string(),
    size: v.union([v.literal(1), v.literal(2)]),
    channels: v.array(v.picklist(["email", "sms"])),
    subscribed: v.boolean(),
    age: v.number(),
  }),
});

const countries = [
  { value: "GB", label: "United Kingdom" },
  { value: "IE", label: "Ireland" },
] as const;

// Stands for the field's options.
function RightUses() {
  const form = createForm(profile);
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
  const form = createForm(profile);
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
function OwnValidateSelect(props: { field: FieldApi<Choice>; options: readonly Option<Choice>[]; validate?: boolean }) {
  return <select {...props.field.inputProps({ kind: "select" })} data-validate={props.validate} />;
}

// Rejects options and fields that don't fit.
function WrongUses() {
  const form = createForm(profile);
  return (
    <>
      {/* @ts-expect-error: FR is not one of the country options */}
      <form.SelectField name="country" label="Country" options={[{ value: "FR", label: "France" }]} />
      {/* @ts-expect-error: subscribed is a boolean */}
      <form.SelectField name="subscribed" label="Subscribed" options={[]} />
      {/* @ts-expect-error: age is a number, SelectField takes strings */}
      <form.SelectField name="age" label="Age" options={[]} />
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
      {/* @ts-expect-error: the handle's field is a boolean */}
      <form.SelectField handle={form.root.at("subscribed")} label="Subscribed" options={[]} />
      {/* @ts-expect-error: the component's own label prop is required */}
      <form.SelectField name="country" options={countries} />
      {/* @ts-expect-error: country is a picklist, TextField edits any string */}
      <form.TextField name="country" label="Country" />
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

  it("rejects options and fields that don't fit", () => {
    expectTypeOf(WrongUses).toBeFunction();
  });
});
