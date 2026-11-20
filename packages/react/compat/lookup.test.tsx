import { fireEvent } from "@testing-library/dom";
import { useEffect, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { createForms, elementsOf, fieldOf, type FormOf, radioProps, trackElements, useField, useForm } from "../src/index.js";
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
  const l = radioProps(useField(size), "l");
  const s = radioProps(useField(size), "s");
  const m = radioProps(useField(size), "m");
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

afterEach(() => {
  vi.unstubAllEnvs();
});

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

// Last, since tracking stays on once `trackElements` runs. Before React 19 a
// removal is reported when the adapter next sweeps the field's elements.
it("trackElements finds fields in production and reports removals", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const events: [object, object, boolean, string][] = [];
  trackElements((...event) => events.push(event));
  const { container } = await render(<Order />);
  const find = (selector: string): Element => {
    const element = container.querySelector(selector);
    if (element === null) throw new Error(`Nothing matches ${selector}.`);
    return element;
  };
  const toggle = () => act(() => fireEvent.click(find("button")));
  const size = holder.form?.root.at("size");
  if (size === undefined) throw new Error("no form rendered");
  expect(fieldOf(find('[data-size="s"]'))).toBe(size);
  await toggle();
  const large = find('[data-size="l"]');
  expect(events).toContainEqual([large, size, true, "react"]);
  await toggle();
  elementsOf(size);
  expect(events).toContainEqual([large, size, false, "react"]);
  expect(fieldOf(large)).toBeUndefined();
});
