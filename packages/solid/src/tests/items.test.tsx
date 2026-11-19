import { valibot } from "@lunarhue/forms-schema/valibot";
import { For } from "solid-js";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createForm, createForms, createItems, type FormOf, inputProps } from "../index.js";
import { getAs, mount, settle, typeText } from "./dom.js";

const forms = createForms({ plugins: [valibot()] });
const List = forms.define({
  schema: v.object({ rows: v.array(v.object({ title: v.string() })) }),
  defaultValues: { rows: [{ title: "a" }, { title: "b" }, { title: "c" }] },
});
type ListForm = FormOf<typeof List>;

/** The row inputs in document order. */
function rowInputs(host: HTMLElement): HTMLInputElement[] {
  return [...host.querySelectorAll<HTMLInputElement>("input")];
}

/** Mounts the list with `form.Items`, counting row bodies. */
function mountList() {
  let form: ListForm | undefined;
  const rowBodies: string[] = [];
  const { host } = mount(() => {
    form = createForm(List);
    const f = form;
    return (
      <f.Items name="rows" fallback={<p>Empty</p>}>
        {(row, index) => {
          rowBodies.push(row.key);
          return (
            <f.Field handle={row.at("title")}>
              {(field) => <input data-index={index()} {...inputProps(field)} />}
            </f.Field>
          );
        }}
      </f.Items>
    );
  });
  if (!form) throw new Error("The form was not created.");
  return { form, host, rowBodies };
}

describe("Items", () => {
  it("keeps each row's DOM node and input state through push, remove and move", async () => {
    const { form, host, rowBodies } = mountList();
    const rows = form.root.at("rows");
    const [a, b, c] = rowInputs(host);
    if (!a || !b || !c) throw new Error("Expected three rows.");
    expect(rowInputs(host).map((input) => input.value)).toEqual(["a", "b", "c"]);

    // A caret and a value the user typed live in the DOM node.
    typeText(b, "bee", 1);
    await settle();

    rows.push({ title: "d" });
    await settle();
    expect(rowInputs(host).slice(0, 3)).toEqual([a, b, c]);

    rows.remove(0);
    await settle();
    expect(rowInputs(host).slice(0, 2)).toEqual([b, c]);
    expect(a.isConnected).toBe(false);

    rows.move(1, 0);
    await settle();
    const moved = rowInputs(host);
    expect(moved.slice(0, 2)).toEqual([c, b]);
    expect(moved.map((input) => input.value)).toEqual(["c", "bee", "d"]);
    expect(moved.map((input) => input.dataset.index)).toEqual(["0", "1", "2"]);
    expect(moved.map((input) => input.name)).toEqual(["rows.0.title", "rows.1.title", "rows.2.title"]);
    expect(b.selectionStart).toBe(1);

    // One body per key, never again for a key that stayed.
    expect(rowBodies).toHaveLength(4);
    expect(new Set(rowBodies).size).toBe(4);
  });

  it("shows the fallback while the array is empty", async () => {
    const { form, host } = mountList();
    form.root.at("rows").setValue([]);
    await settle();
    expect(host.textContent).toBe("Empty");
  });

  it("doesn't change the list on an edit inside an item", async () => {
    let form: ListForm | undefined;
    let runs = 0;
    const { host } = mount(() => {
      form = createForm(List);
      const items = createItems(form.root.at("rows"));
      return (
        <For each={(runs++, items())}>
          {(row) => <span>{row.key}</span>}
        </For>
      );
    });
    const before = runs;
    form?.root.at("rows").item(form.root.at("rows").peek().keys[0] ?? "").at("title").setValue("edited");
    await settle();
    expect(runs).toBe(before);
    expect(getAs(host, "span", HTMLSpanElement).textContent).toBe(form?.root.at("rows").peek().keys[0]);
  });
});
