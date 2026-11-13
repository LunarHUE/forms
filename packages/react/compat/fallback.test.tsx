import * as React from "react";
import { useLayoutEffect } from "react";
import { expect, it } from "vitest";
import { createForms, type LeafHandle, useField } from "../src/index.js";
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
  const form = profile.useForm();
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
});

it("shows a store write that lands in a child's layout effect, before the parent subscribes", async () => {
  const { container } = await render(<Reader />);
  expect(container.textContent).toBe("after");
});
