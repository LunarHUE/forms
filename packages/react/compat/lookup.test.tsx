import { fireEvent } from "@testing-library/dom";
import { useEffect, useState } from "react";
import { expect, it } from "vitest";
import { createForms, elementsOf, fieldOf, type FormOf, useForm, useInputProps } from "../src/index.js";
import { act, render } from "./render.js";

const forms = createForms();
const order = forms.define({ defaultValues: { size: "s" } });

const holder: { form?: FormOf<typeof order> } = {};

/** The button shows and hides an "l" option ahead of the others. */
function Order() {
  const form = useForm(order, { id: "order" });
  const [large, setLarge] = useState(false);
  useEffect(() => {
    holder.form = form;
  });
  const size = form.root.at("size");
  const l = useInputProps(size, { kind: "radio", value: "l" });
  const s = useInputProps(size, { kind: "radio", value: "s" });
  const m = useInputProps(size, { kind: "radio", value: "m" });
  return (
    <div>
      <button type="button" onClick={() => setLarge(!large)}>
        large
      </button>
      {large ? <input data-size="l" {...l} /> : null}
      <input data-size="s" {...s} />
      <input data-size="m" {...m} />
    </div>
  );
}

// React before 19 calls a ref with `null` without saying which element left.
it("elementsOf and fieldOf follow elements that mount and unmount", async () => {
  const { container } = await render(<Order />);
  const find = (selector: string): Element => {
    const element = container.querySelector(selector);
    if (element === null) throw new Error(`Nothing matches ${selector}.`);
    return element;
  };
  const option = (value: string) => find(`[data-size="${value}"]`);
  const toggle = () => act(() => fireEvent.click(find("button")));
  const size = holder.form?.root.at("size");
  if (size === undefined) throw new Error("no form rendered");
  expect(fieldOf(option("s"))).toBe(size);
  await toggle();
  expect(elementsOf(size)).toEqual([option("l"), option("s"), option("m")]);
  expect(fieldOf(option("l"))).toBe(size);
  await toggle();
  expect(elementsOf(size)).toEqual([option("s"), option("m")]);
});
