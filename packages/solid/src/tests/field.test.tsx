import { createEffect, flush, major } from "./solid.js";
import { valibot } from "@lunarhue/forms-schema/valibot";
import { createMemo, createRoot, createSignal, Show } from "solid-js";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createField, createForm, createForms, createItems, createValidator, type FieldApi, type FormOf, inputProps } from "../index.js";
import { countSubscriptions, get, mount, settle, typeText } from "./dom.js";
import { arrays } from "../plugins.js";

const forms = createForms({ plugins: [arrays(), valibot()] });
const Profile = forms.define({
  schema: v.object({
    first: v.pipe(v.string(), v.minLength(1, "Required")),
    last: v.string(),
    age: v.number(),
    rows: v.array(v.object({ title: v.string() })),
  }),
});

/** One text input for the first name. */
function FirstName() {
  const form = createForm(Profile);
  return <form.Field name="first">{(field) => <input {...inputProps(field)} />}</form.Field>;
}

/** Writes to the store from its body and from a memo. */
function WritesWhileRendering() {
  const form = createForm(Profile);
  form.root.at("first").setValue("from body");
  const upper = createMemo(() => {
    const last = form.root.at("last");
    if (last.peek().value === "") last.setValue("from memo");
    return last.peek().value.toUpperCase();
  });
  return (
    <form.Field name="first">
      {(field) => (
        <p>
          {field.value} {upper()}
        </p>
      )}
    </form.Field>
  );
}

describe("fine-grained updates", () => {
  it("re-runs only the edited field's bindings, and component bodies once", async () => {
    const bodies = { page: 0, first: 0, last: 0 };
    const reads = { first: 0, last: 0 };
    function Input(props: { field: FieldApi<string>; which: "first" | "last" }) {
      bodies[props.which]++;
      return (
        <input
          data-which={props.which}
          {...inputProps(props.field)}
          data-reads={(reads[props.which]++, props.field.value.length)}
        />
      );
    }
    function TwoFields() {
      bodies.page++;
      const form = createForm(Profile);
      return (
        <form.Form>
          <form.Field name="first">{(field) => <Input field={field} which="first" />}</form.Field>
          <form.Field name="last">{(field) => <Input field={field} which="last" />}</form.Field>
        </form.Form>
      );
    }
    const { host } = mount(() => <TwoFields />);
    const first = get(host, "[data-which=first]");
    const last = get(host, "[data-which=last]");
    const before = { ...reads };

    typeText(first, "Ada");
    typeText(first, "Adam");
    await settle();

    expect(first.value).toBe("Adam");
    expect(first.dataset.reads).toBe("4");
    // In Solid 2 two writes in one tick land in one flush. Solid 1 applies each
    // write at once. Either way the other field's binding never re-runs.
    expect(reads.first - before.first).toBe(major === 1 ? 2 : 1);
    expect(reads.last - before.last).toBe(0);
    expect(last.dataset.reads).toBe("0");
    expect(bodies).toEqual({ page: 1, first: 1, last: 1 });
  });

  it("re-runs an effect over one field once per change of that field", () => {
    // Solid 1 runs the effects once the root's function returns, so the writes come after it.
    const store = Profile.createStore();
    const runs = { first: 0, last: 0 };
    const dispose = createRoot((disposeRoot) => {
      const first = createField(store.root.at("first"));
      const last = createField(store.root.at("last"));
      createEffect(
        () => first.value,
        () => void runs.first++,
      );
      createEffect(
        () => last.value,
        () => void runs.last++,
      );
      return disposeRoot;
    });
    flush();
    store.root.at("first").setValue("A");
    flush();
    store.root.at("first").setValue("Ab");
    flush();
    expect(runs).toEqual({ first: 3, last: 1 });
    dispose();
  });
});

describe("subscription lifetime", () => {
  it("subscribes in the owner and unsubscribes when it is disposed", () => {
    const store = Profile.createStore();
    const live = countSubscriptions(store);
    const dispose = createRoot((disposeRoot) => {
      createField(store.root.at("first"));
      createField(store.root.at("last"));
      createItems(store.root.at("rows"));
      createValidator(store.root.at("last"), () => null);
      return disposeRoot;
    });
    expect(live).toEqual({ fields: 3, form: 0 });
    dispose();
    expect(live).toEqual({ fields: 0, form: 0 });
  });

  it("subscribes to nothing outside an owner and reads the current snapshot", () => {
    const store = Profile.createStore();
    const live = countSubscriptions(store);
    const first = createField(store.root.at("first"));
    const rows = createItems(store.root.at("rows"));
    expect(live).toEqual({ fields: 0, form: 0 });
    store.root.at("first").setValue("Grace");
    store.root.at("rows").push({ title: "a" });
    expect(first.value).toBe("Grace");
    expect(rows()).toHaveLength(1);
    expect(live).toEqual({ fields: 0, form: 0 });
  });

  it("subscribes form state on its first read inside an owner and ends with the form's owner", () => {
    let form: FormOf<typeof Profile> | undefined;
    let live = { fields: 0, form: 0 };
    let showCount: (() => void) | undefined;
    function Count(props: { form: FormOf<typeof Profile> }) {
      return <p>{props.form.state.submitCount}</p>;
    }
    const { host, dispose } = mount(() => {
      form = createForm(Profile);
      live = countSubscriptions(form.store);
      const [shown, setShown] = createSignal(false);
      showCount = () => setShown(true);
      return <Show when={shown()}>{form ? <Count form={form} /> : null}</Show>;
    });
    // A read outside any owner reads the snapshot and subscribes nothing.
    expect(form?.state.submitting).toBe(false);
    expect(live.form).toBe(0);
    showCount?.();
    flush();
    expect(host.textContent).toBe("0");
    expect(live.form).toBe(1);
    dispose();
    expect(live).toEqual({ fields: 0, form: 0 });
  });

  it("works again in a form disposed and created again", async () => {
    mount(() => <FirstName />).dispose();
    const { host } = mount(() => <FirstName />);
    const input = get(host, "input");
    typeText(input, "again");
    await settle();
    expect(input.value).toBe("again");
  });

  it("keeps a store working after every subscriber left and a new one came", () => {
    const store = Profile.createStore();
    createRoot((dispose) => {
      createField(store.root.at("first"));
      dispose();
    });
    createRoot((dispose) => {
      const first = createField(store.root.at("first"));
      store.root.at("first").setValue("back");
      flush();
      expect(first.value).toBe("back");
      dispose();
    });
  });
});

describe("batching", () => {
  it("allows a write from a component body or a memo", async () => {
    const { host } = mount(() => <WritesWhileRendering />);
    await settle();
    expect(host.textContent).toBe("from body FROM MEMO");
  });

  it("shows a value written in an input handler after a microtask, and keeps the caret", async () => {
    const { host } = mount(() => <FirstName />);
    const input = get(host, "input");
    typeText(input, "abcd");
    await settle();
    // The user types "X" between "b" and "c". The browser puts the caret after it.
    typeText(input, "abXcd", 3);
    await Promise.resolve();
    expect(input.value).toBe("abXcd");
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(3);
  });

  it("shows a programmatic write after flush", () => {
    let form: FormOf<typeof Profile> | undefined;
    const { host } = mount(() => {
      form = createForm(Profile);
      return <form.Field name="last">{(field) => <input {...inputProps(field)} />}</form.Field>;
    });
    form?.root.at("last").setValue("Lovelace");
    flush();
    expect(get(host, "input").value).toBe("Lovelace");
  });
});
