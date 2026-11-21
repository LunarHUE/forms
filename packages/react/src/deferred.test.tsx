import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useDebugValue, useDeferredValue, useEffect, useState } from "react";
import { expect, it } from "vitest";
import { createForms, type FieldApi, type FormOf, type NamedLeafHandle, useField, useForm, inputProps } from "./index.js";

// TanStack Table issue 6577: a table object that reads live mutable state
// through methods, passed through an unrelated hook such as useDeferredValue
// or useDebugValue, makes the Compiler memoize the read, and the output stays
// stuck on an old value. Here the same shapes go through this adapter: the
// value comes from useField or a field object, never from a live method.

const forms = createForms();
const note = forms.define({ defaultValues: { text: "" } });

function DeferredValue(props: { readonly handle: NamedLeafHandle<string> }) {
  const value = useField(props.handle, (snapshot) => snapshot.value);
  const deferred = useDeferredValue(value);
  useDebugValue(deferred);
  return <output aria-label="from useField">{deferred}</output>;
}

function DeferredSnapshot(props: { readonly handle: NamedLeafHandle<string> }) {
  const snapshot = useField(props.handle);
  const deferred = useDeferredValue(snapshot);
  useDebugValue(deferred.value);
  return <output aria-label="from snapshot">{deferred.value}</output>;
}

function DeferredFieldObject(props: { readonly field: FieldApi<string> }) {
  const deferred = useDeferredValue(props.field);
  return <output aria-label="from field object">{deferred.value}</output>;
}

// The stable handle goes through useDeferredValue and the read comes after it.
function DeferredHandle(props: { readonly handle: NamedLeafHandle<string> }) {
  const handle = useDeferredValue(props.handle);
  const value = useField(handle).value;
  return <output aria-label="from deferred handle">{value}</output>;
}

type NoteStore = FormOf<typeof note>["store"];

function Editor(props: { readonly onStore: (store: NoteStore) => () => void }) {
  const form = useForm(note);
  const text = form.root.at("text");
  const [store] = useState(() => form.store);
  const { onStore } = props;
  useEffect(() => onStore(store), [onStore, store]);
  return (
    <>
      <input aria-label="text" {...inputProps(useField(text))} />
      <DeferredValue handle={text} />
      <DeferredSnapshot handle={text} />
      <form.Field name="text">{(field) => <DeferredFieldObject field={field} />}</form.Field>
      <DeferredHandle handle={text} />
    </>
  );
}

it("a deferred field value ends correct and never shows a value the store never held", async () => {
  const held = new Set<string>([""]);
  const onStore = (store: NoteStore) =>
    store.subscribe(store.root.path, () => {
      held.add(store.root.peek().value.text);
    });
  render(<Editor onStore={onStore} />);

  const outputs = screen.getAllByRole("status");
  const shown: string[] = [];
  const observer = new MutationObserver(() => {
    for (const output of outputs) shown.push(output.textContent);
  });
  for (const output of outputs) observer.observe(output, { childList: true, characterData: true, subtree: true });

  const user = userEvent.setup();
  const typed = "the quick brown fox";
  await user.type(screen.getByLabelText("text"), typed);
  await user.type(screen.getByLabelText("text"), "{Backspace}{Backspace}{Backspace}{Backspace}");
  await user.type(screen.getByLabelText("text"), " jumps");
  observer.disconnect();

  const final = "the quick brown jumps";
  expect(outputs).toHaveLength(4);
  for (const output of outputs) expect(output.textContent).toBe(final);
  expect(shown.length).toBeGreaterThan(typed.length);
  for (const text of shown) expect(held).toContain(text);
});
