import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { useSelected } from "./select.js";
import { useInputProps } from "./input.js";
import { createForms, useField, useFormState, useItems, useValidator } from "./index.js";

const forms = createForms();
const profile = forms.define({ defaultValues: { name: "Ada" } });

function NameLabel() {
  const form = profile.useForm();
  const name = useField(form.root.at("name"), (snapshot) => snapshot.value.toUpperCase());
  return <p>{name}</p>;
}

// The Compiler's output reads its memo cache as `$[n]`. Uncompiled code never does.
const compiled = /\$\[\d+\]/;

it("compiles the test components", () => {
  render(<NameLabel />);
  expect(screen.getByText("ADA")).toBeTruthy();
  expect(String(NameLabel)).toMatch(compiled);
});

it("compiles the adapter's hooks", () => {
  for (const hook of [useSelected, useInputProps, useField, useFormState, useItems, useValidator]) {
    expect(String(hook)).toMatch(compiled);
  }
});
