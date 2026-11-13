import { useLayoutEffect } from "react";
import { expect, it } from "vitest";
import { createForms, useField, useFormState } from "../src/index.js";
import { modern, render } from "./render.js";

const profile = createForms().define({ defaultValues: { name: "" } });
type ProfileForm = ReturnType<typeof profile.useForm>;
const holder: { form?: ProfileForm } = {};
const shown: string[] = [];

/** Reads the field and the form, so one write wakes two of its listeners. */
function Both() {
  const form = profile.useForm();
  const name = useField(form.root.at("name"), (snapshot) => snapshot.value);
  const dirty = useFormState(form, (snapshot) => snapshot.dirty);
  const text = `${name}:${dirty}`;
  useLayoutEffect(() => {
    holder.form = form;
    shown.push(text);
  });
  return <p>{text}</p>;
}

// React 16 and 17 batch only inside their own event handlers and `act`. A
// write from anywhere else renders at once, inside the store's listener.
it.runIf(!modern)("renders an unbatched write once, consistent and at once", async () => {
  const { container } = await render(<Both />);
  shown.length = 0;
  holder.form?.root.at("name").setValue("Ada");
  expect(container.textContent).toBe("Ada:true");
  expect(shown).toEqual(["Ada:true"]);
});
