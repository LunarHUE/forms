import { describe, expectTypeOf, it } from "vitest";
import {
  createForms,
  errorId,
  Field,
  Items,
  type CheckboxInputProps,
  type ItemHandle,
  type LeafHandle,
  type NumberInputProps,
  type RadioInputProps,
  type SchemaAdapter,
  type SelectProps,
  type StandardSchemaV1,
  type TextInputProps,
  useDisabledErrors,
  useField,
  useFieldRef,
  useFormState,
  useInputProps,
} from "./index.js";

interface FakeSchema<I, O = I> extends StandardSchemaV1<I, O> {
  readonly fake: true;
}
declare const fakeAdapter: SchemaAdapter<FakeSchema<unknown>>;

function Text({ name, bio }: { readonly name: LeafHandle<string>; readonly bio: LeafHandle<string | undefined> }) {
  const props = useInputProps(name);
  expectTypeOf(props).toEqualTypeOf<TextInputProps>();
  expectTypeOf(useInputProps(name, { kind: "text" })).toEqualTypeOf<TextInputProps>();
  return (
    <>
      <input type="email" {...props} />
      <textarea {...useInputProps(bio)} />
    </>
  );
}

function NumberInputs({ draft, plain }: { readonly draft: LeafHandle<number | undefined>; readonly plain: LeafHandle<number> }) {
  const draftProps = useInputProps(draft, { kind: "number" });
  expectTypeOf(draftProps).toEqualTypeOf<NumberInputProps>();
  const plainProps = useInputProps(plain, { kind: "number", empty: 0 });
  // @ts-expect-error: an empty input needs a number to write, since undefined is not allowed
  useInputProps(plain, { kind: "number" });
  return (
    <>
      <input {...draftProps} />
      <input {...plainProps} min={0} />
    </>
  );
}

function Checkbox({ newsletter }: { readonly newsletter: LeafHandle<boolean> }) {
  const props = useInputProps(newsletter, { kind: "checkbox" });
  expectTypeOf(props).toEqualTypeOf<CheckboxInputProps>();
  return <input {...props} />;
}

function Radios({ plan }: { readonly plan: LeafHandle<"free" | "pro"> }) {
  const free = useInputProps(plan, { kind: "radio", value: "free" });
  const pro = useInputProps(plan, { kind: "radio", value: "pro" });
  expectTypeOf(pro).toEqualTypeOf<RadioInputProps>();
  // @ts-expect-error: not one of the plan's options
  useInputProps(plan, { kind: "radio", value: "team" });
  return (
    <>
      <input {...free} />
      <input {...pro} />
    </>
  );
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

function WrongKinds({
  age,
  name,
  newsletter,
}: {
  readonly age: LeafHandle<number>;
  readonly name: LeafHandle<string>;
  readonly newsletter: LeafHandle<boolean>;
}) {
  // @ts-expect-error: a text input writes strings, and age is a number
  useInputProps(age);
  // @ts-expect-error: a checkbox writes booleans, and name is a string
  useInputProps(name, { kind: "checkbox" });
  // @ts-expect-error: a number input writes numbers, and newsletter is a boolean
  useInputProps(newsletter, { kind: "number", empty: false });
  return <span />;
}

const addressStore = createForms().define({ defaultValues: { address: { city: "" } } }).createStore();

function NotALeaf() {
  // @ts-expect-error: an object field has no input
  useInputProps(addressStore.root.at("address"));
  return <span />;
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

// A complete form, written the way app code would be.
interface Invoice {
  customer: string;
  total: number;
  paid: boolean;
  lines: { item: string; qty: number }[];
}
declare const invoiceSchema: FakeSchema<Invoice>;
const invoice = createForms({ schemas: [fakeAdapter] }).define({
  schema: invoiceSchema,
  onSubmit: async (value) => {
    const response = await fetch("/invoices", { method: "POST", body: JSON.stringify(value) });
    return { status: response.status };
  },
});

function Errors({ handle }: { readonly handle: LeafHandle<string> | LeafHandle<number | undefined> }) {
  const errors = useField(handle, (snapshot) => snapshot.shownErrors);
  if (errors.length === 0) return null;
  return <p id={errorId(handle)}>{errors.map((error) => error.message).join(" ")}</p>;
}

type Line = { item: string; qty: number | undefined };

function LineRow({ line, onRemove }: { readonly line: ItemHandle<Line>; readonly onRemove: () => void }) {
  return (
    <li>
      <input {...useInputProps(line.at("item"))} />
      <input {...useInputProps(line.at("qty"), { kind: "number" })} />
      <button type="button" onClick={onRemove}>
        Remove
      </button>
    </li>
  );
}

function InvoiceForm() {
  const form = invoice.useForm();
  const { customer, total, paid, lines } = {
    customer: form.root.at("customer"),
    total: form.root.at("total"),
    paid: form.root.at("paid"),
    lines: form.root.at("lines"),
  };
  const { submitting, submission } = useFormState(form);
  const blocked = useDisabledErrors(form);
  return (
    <form {...form.formProps}>
      <label htmlFor={customer.id}>Customer</label>
      <input {...useInputProps(customer)} />
      <Errors handle={customer} />
      <input {...useInputProps(total, { kind: "number" })} />
      <Errors handle={total} />
      <label>
        <input {...useInputProps(paid, { kind: "checkbox" })} /> Paid
      </label>
      <ul>
        <Items handle={lines}>{(line, index) => <LineRow line={line} onRemove={() => lines.remove(index)} />}</Items>
      </ul>
      <button type="button" onClick={() => lines.push()}>
        Add line
      </button>
      <Field handle={lines} select={(snapshot) => snapshot.keys.length}>
        {(count) => <p>{count} lines</p>}
      </Field>
      {blocked.map((entry) => (
        <p key={entry.field.id}>
          {entry.name}: {entry.errors[0]?.message}
        </p>
      ))}
      {submission.status === "succeeded" && <p>Saved with status {submission.result.status}</p>}
      <button type="submit" disabled={submitting}>
        Save
      </button>
    </form>
  );
}

describe("useInputProps checks the kind against the value type", () => {
  it("binds text, number, checkbox, radio and select inputs", () => {
    expectTypeOf(Text).toBeFunction();
    expectTypeOf(NumberInputs).toBeFunction();
    expectTypeOf(Checkbox).toBeFunction();
    expectTypeOf(Radios).toBeFunction();
    expectTypeOf(Selects).toBeFunction();
  });

  it("rejects kinds that don't fit the value type, and handles that are not leaves", () => {
    expectTypeOf(WrongKinds).toBeFunction();
    expectTypeOf(NotALeaf).toBeFunction();
  });

  it("gives custom inputs a ref and an error id", () => {
    expectTypeOf(DatePicker).toBeFunction();
  });
});

describe("a complete form", () => {
  it("typechecks with no annotations in the components", () => {
    expectTypeOf(InvoiceForm).toBeFunction();
  });
});
