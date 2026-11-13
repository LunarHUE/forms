import * as React from "react";
import { useLayoutEffect } from "react";
import { expect, inject, it } from "vitest";
import { type Added, hooks } from "../src/compat.js";
import { createForms, type LeafHandle, useField, useForm } from "../src/index.js";
import { modern, render } from "./render.js";

const profile = createForms().define({ defaultValues: { name: "before" } });

/** Writes to the store in its layout effect, which runs before its parent's and before any effect subscribes. */
function Writer(props: { readonly name: LeafHandle<string> }) {
  const { name } = props;
  useLayoutEffect(() => {
    name.setValue("after");
  }, [name]);
  return null;
}

function Reader() {
  const form = useForm(profile);
  const name = form.root.at("name");
  const value = useField(name, (snapshot) => snapshot.value);
  return (
    <>
      <p>{value}</p>
      <Writer name={name} />
    </>
  );
}

it("uses React's own hooks on 18 and later and the fallbacks before", () => {
  const exports: object = React;
  expect("useSyncExternalStore" in exports).toBe(modern);
  expect("useId" in exports).toBe(modern);
  const added: Added = React;
  expect(hooks.useSyncExternalStore === added.useSyncExternalStore).toBe(modern);
  expect(hooks.useId === added.useId).toBe(modern);
  // Only the legacy entry warns about generated ids.
  expect(hooks.generatedIdUsed !== undefined).toBe(inject("entry") === "legacy");
});

it("shows a store write that lands in a child's layout effect, before the parent subscribes", async () => {
  const { container } = await render(<Reader />);
  expect(container.textContent).toBe("after");
});
