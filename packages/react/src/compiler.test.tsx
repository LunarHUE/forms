import { transformAsync } from "@babel/core";
import { render, screen } from "@testing-library/react";
import reactCompiler from "babel-plugin-react-compiler";
import { expect, it } from "vitest";
import { useSelected } from "./select.js";
import {
  createForms,
  elementsOf,
  fieldOf,
  type FieldApi,
  inputProps,
  type NamedLeafHandle,
  useField,
  useFieldRef,
  useForm,
  useFormState,
  useItems,
  useValidator,
} from "./index.js";

const forms = createForms();
const profile = forms.define({ defaultValues: { name: "Ada" } });

function NameLabel() {
  const form = useForm(profile);
  const name = useField(form.root.at("name"), (snapshot) => snapshot.value.toUpperCase());
  return <p>{name}</p>;
}

interface HandleProps {
  readonly handle: NamedLeafHandle<string>;
}

// The bindings below are the ones the docs give for a component library's
// primitives. The Compiler runs over this file with `panicThreshold:
// "all_errors"`, so one that bails out fails the whole file.

/** The field's pieces, with `ref` taken out of the field before JSX passes it. */
function PiecesInput({ handle }: HandleProps) {
  const field = useField(handle);
  const { ref } = field;
  return (
    <input
      aria-label="pieces"
      ref={ref}
      name={field.name}
      value={field.text}
      onChange={(event) => field.setText(event.target.value, event)}
      onBlur={field.handleBlur}
    />
  );
}

function RefHookInput({ handle }: HandleProps) {
  const field = useField(handle);
  const ref = useFieldRef(handle);
  return <input aria-label="ref hook" ref={ref} name={field.name} value={field.text} readOnly />;
}

function PropsInput({ handle }: HandleProps) {
  return <input aria-label="props" {...inputProps(useField(handle))} />;
}

interface FieldProps {
  readonly field: FieldApi<string>;
}

/** A registered field component's binding, which gets the field object as a prop. */
function FieldInput({ field }: FieldProps) {
  const { ref } = field;
  return <input aria-label="field prop" ref={ref} name={field.name} value={field.text} readOnly />;
}

const signup = forms.define({ defaultValues: { email: "ada@example.com" } });

function Signup() {
  const form = useForm(signup);
  const email = form.root.at("email");
  return (
    <>
      <PiecesInput handle={email} />
      <RefHookInput handle={email} />
      <PropsInput handle={email} />
      {/* A render prop isn't render code to the Compiler, so `field.ref` can go straight in. */}
      <form.Field name="email">{(field) => <input aria-label="render prop" ref={field.ref} name={field.name} value={field.text} readOnly />}</form.Field>
      <form.Field name="email">{(field) => <FieldInput field={field} />}</form.Field>
    </>
  );
}

// The Compiler's output reads its memo cache as `$[n]`. Uncompiled code never does.
const compiled = /\$\[\d+\]/;

it("compiles the test components", () => {
  render(<NameLabel />);
  expect(screen.getByText("ADA")).toBeTruthy();
  expect(String(NameLabel)).toMatch(compiled);
});

it("compiles the adapter's hooks", () => {
  for (const hook of [useSelected, useField, useFormState, useItems, useValidator]) {
    expect(String(hook)).toMatch(compiled);
  }
});

it("compiles the documented ways to bind a field's ref", () => {
  for (const component of [PiecesInput, RefHookInput, PropsInput, FieldInput, Signup]) {
    expect(String(component)).toMatch(compiled);
  }
  render(<Signup />);
  const inputs = ["pieces", "ref hook", "props", "render prop", "field prop"].map((label) => screen.getByLabelText(label));
  for (const input of inputs) expect(input).toHaveProperty("value", "ada@example.com");
  // Each one recorded its element through the field's ref.
  const email = fieldOf(inputs[0] ?? document.body);
  expect(email && elementsOf(email)).toEqual(inputs);
});

// When this starts passing, the Compiler no longer treats an object whose
// member goes to `ref` as a ref, and the docs can drop their advice to take
// `ref` out of the field first.
it("bails out on `ref={field.ref}` in render code", async () => {
  const reasons: string[] = [];
  await transformAsync(
    `function Email({ field }) {
      return <input ref={field.ref} name={field.name} value={field.text} />;
    }`,
    {
      filename: "email.jsx",
      babelrc: false,
      configFile: false,
      parserOpts: { plugins: ["jsx"] },
      plugins: [
        [
          reactCompiler,
          {
            target: "19",
            panicThreshold: "none",
            logger: { logEvent: (_file: string | null, event: { kind: string; detail?: { reason?: string } }) => {
              if (event.kind === "CompileError") reasons.push(event.detail?.reason ?? "");
            } },
          },
        ],
      ],
    },
  );
  expect(reasons).toEqual(["Cannot access refs during render", "Cannot access refs during render", "Cannot access refs during render"]);
});
