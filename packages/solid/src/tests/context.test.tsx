import { valibot } from "@lunarhue/forms-schema/valibot";
import { createSignal, Errored, flush, Show } from "solid-js";
import * as v from "valibot";
import { describe, expect, it, vi } from "vitest";
import { createForm, createForms, useFormContext, type AnyForm, type FormOf } from "../index.js";
import { dirty } from "../plugins.js";
import { getAs, mount, settle } from "./dom.js";

const forms = createForms({ plugins: [valibot(), dirty()] });
const Order = forms.define({
  schema: v.object({ customer: v.pipe(v.string(), v.minLength(1, "Required")) }),
  onSubmit: () => "saved",
});
const Note = forms.define({ defaultValues: { text: "" } });

function SubmitButton() {
  const form = useFormContext();
  return (
    <button type="submit" data-form={form.id} disabled={form.state.submitting}>
      Save
    </button>
  );
}

function OrderCustomer() {
  const form = useFormContext(Order);
  return <form.Field name="customer">{(field) => <span data-order={form.id}>{field.value}</span>}</form.Field>;
}

// A reusable part for any form: it knows no definition.
function Controls() {
  const form = useFormContext();
  return (
    <p data-controls={form.id}>
      <button type="button" data-submit onClick={() => void form.submit()} />
      <button type="button" data-reset onClick={() => form.store.reset()} />
      <span>{`${form.state.submitCount} ${form.state.dirty ? "dirty" : "clean"}`}</span>
    </p>
  );
}

// A part shared by every form of `forms`. `otherForms` is another `createForms` call.
const otherForms = createForms();
const Comment = otherForms.define({ defaultValues: { body: "" } });

function SharedId() {
  const form = useFormContext(forms);
  return <span data-shared={form.id} />;
}

describe("context", () => {
  it("gives a submit button the nearest form, reactively", async () => {
    let form: FormOf<typeof Order> | undefined;
    const { host } = mount(() => {
      form = createForm(Order, { id: "order" });
      const f = form;
      return (
        <f.Form>
          {(props, owner) => (
            <form {...props}>
              <SubmitButton />
              <button type="button" onClick={() => void owner.submit()}>
                Go
              </button>
            </form>
          )}
        </f.Form>
      );
    });
    const button = getAs(host, "[data-form]", HTMLButtonElement);
    expect(button.dataset.form).toBe("order");
    expect(button.disabled).toBe(false);
    form?.root.at("customer").setValue("Ada");
    const running = form?.submit();
    await settle();
    expect(button.disabled).toBe(true);
    await running;
    await settle();
    expect(button.disabled).toBe(false);
  });

  it("finds a definition's own form under another form's Form", () => {
    const { host } = mount(() => {
      const order = createForm(Order, { id: "order" });
      const note = createForm(Note, { id: "note" });
      order.root.at("customer").setValue("Grace");
      return (
        <order.Form>
          <form {...order.formProps}>
            <OrderCustomer />
          </form>
          {/* A dialog with its own form, rendered inside the order's tree. */}
          <note.Form>
            {(props) => (
              <form {...props}>
                <SubmitButton />
                <OrderCustomer />
              </form>
            )}
          </note.Form>
        </order.Form>
      );
    });
    const elements = host.querySelectorAll("form");
    expect(elements).toHaveLength(2);
    expect(getAs(elements[1] ?? host, "[data-form]", HTMLElement).dataset.form).toBe("note");
    const customers = [...host.querySelectorAll<HTMLElement>("[data-order]")];
    expect(customers.map((span) => [span.dataset.order, span.textContent])).toEqual([
      ["order", "Grace"],
      ["order", "Grace"],
    ]);
  });

  it("works the same generic controls inside forms of two definitions", async () => {
    let note: FormOf<typeof Note> | undefined;
    const { host } = mount(() => {
      const order = createForm(Order, { id: "order" });
      note = createForm(Note, { id: "note" });
      return (
        <>
          <order.Form>
            <Controls />
          </order.Form>
          <note.Form>
            <Controls />
          </note.Form>
        </>
      );
    });
    const controls = (id: string) => getAs(host, `[data-controls="${id}"]`, HTMLElement);
    const text = (id: string) => controls(id).querySelector("span")?.textContent;
    getAs(controls("order"), "[data-submit]", HTMLButtonElement).click();
    await settle();
    expect([text("order"), text("note")]).toEqual(["1 clean", "0 clean"]);
    note?.root.at("text").setValue("hi");
    getAs(controls("note"), "[data-submit]", HTMLButtonElement).click();
    await settle();
    expect([text("order"), text("note")]).toEqual(["1 clean", "1 dirty"]);
    getAs(controls("note"), "[data-reset]", HTMLButtonElement).click();
    await settle();
    expect([text("order"), text("note")]).toEqual(["1 clean", "1 clean"]);
    expect(note?.root.at("text").peek().value).toBe("");
  });

  it("finds the nearest form of the definition past forms of other definitions", () => {
    const { host } = mount(() => {
      const outer = createForm(Order, { id: "outer" });
      const middle = createForm(Note, { id: "middle" });
      const inner = createForm(Order, { id: "inner" });
      return (
        <outer.Form>
          <OrderCustomer />
          <middle.Form>
            <OrderCustomer />
            <inner.Form>
              <OrderCustomer />
            </inner.Form>
          </middle.Form>
        </outer.Form>
      );
    });
    const found = [...host.querySelectorAll<HTMLElement>("[data-order]")].map((span) => span.dataset.order);
    expect(found).toEqual(["outer", "outer", "inner"]);
  });

  it("renders plain children with the context only", () => {
    let seen: AnyForm | undefined;
    function Probe() {
      seen = useFormContext();
      return null;
    }
    let made: unknown;
    mount(() => {
      const note = createForm(Note);
      made = note;
      return (
        <note.Form>
          <Probe />
        </note.Form>
      );
    });
    expect(seen).toBe(made);
  });

  it("throws a clear error with no form.Form above, or none of the definition", () => {
    const { host } = mount(() => {
      const note = createForm(Note);
      return (
        <>
          <Errored fallback={(error) => <p>{String(error())}</p>}>
            <SubmitButton />
          </Errored>
          <Errored fallback={(error) => <p>{String(error())}</p>}>
            <OrderCustomer />
          </Errored>
          <note.Form>
            <Errored fallback={(error) => <p>{String(error())}</p>}>
              <OrderCustomer />
            </Errored>
          </note.Form>
        </>
      );
    });
    const messages = [...host.querySelectorAll("p")].map((p) => p.textContent);
    const missing = expect.stringMatching(
      /^Error: @lunarhue\/forms-solid: useFormContext\(definition\) found no form made from that definition\. It skips forms of other definitions\. Render it inside the `form\.Form` of a form made by `createForm\(definition\)`\. https:\/\/\S+#solid:context:definition$/,
    );
    expect(messages).toEqual([
      expect.stringMatching(
        /^Error: @lunarhue\/forms-solid: useFormContext\(\) found no form\. Render it inside the form's `form\.Form`\. https:\/\/\S+#solid:context:form$/,
      ),
      missing,
      missing,
    ]);
  });

  it("throws a short code and a link in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const { host } = mount(() => {
        const note = createForm(Note);
        return (
          <>
            <Errored fallback={(error) => <p>{String(error())}</p>}>
              <SubmitButton />
            </Errored>
            <note.Form>
              <Errored fallback={(error) => <p>{String(error())}</p>}>
                <OrderCustomer />
              </Errored>
            </note.Form>
            <Errored fallback={(error) => <p>{String(error())}</p>}>
              <SharedId />
            </Errored>
            <Errored fallback={(error) => <p>{String(error())}</p>}>
              {/* @ts-expect-error: a bound component needs a name or a handle */}
              <note.Field>{() => null}</note.Field>
            </Errored>
          </>
        );
      });
      expect([...host.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
        expect.stringMatching(/^Error: @lunarhue\/forms-solid: context:form https:\/\/\S+#solid:context:form$/),
        expect.stringMatching(/^Error: @lunarhue\/forms-solid: context:definition https:\/\/\S+#solid:context:definition$/),
        expect.stringMatching(/^Error: @lunarhue\/forms-solid: context:forms https:\/\/\S+#solid:context:forms$/),
        expect.stringMatching(/^Error: @lunarhue\/forms-solid: field:target https:\/\/\S+#solid:field:target$/),
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("finds the nearest form of the forms past forms of other createForms calls", () => {
    const { host } = mount(() => {
      const outer = createForm(Note, { id: "outer" });
      const inner = createForm(Comment, { id: "comment" });
      return (
        <outer.Form>
          <SharedId />
          <inner.Form>
            <SharedId />
          </inner.Form>
        </outer.Form>
      );
    });
    const found = [...host.querySelectorAll<HTMLElement>("[data-shared]")].map((span) => span.dataset.shared);
    expect(found).toEqual(["outer", "outer"]);
  });

  it("throws a clear error for forms with only another createForms call's form above, or none", () => {
    const { host } = mount(() => {
      const comment = createForm(Comment);
      return (
        <>
          <Errored fallback={(error) => <p>{String(error())}</p>}>
            <SharedId />
          </Errored>
          <comment.Form>
            <Errored fallback={(error) => <p>{String(error())}</p>}>
              <SharedId />
            </Errored>
          </comment.Form>
        </>
      );
    });
    const missing = expect.stringMatching(
      /^Error: @lunarhue\/forms-solid: useFormContext\(forms\) found no form made from those forms\. It skips forms of other `createForms` calls\. Render it inside the `form\.Form` of a form made from one of their definitions\. https:\/\/\S+#solid:context:forms$/,
    );
    expect([...host.querySelectorAll("p")].map((p) => p.textContent)).toEqual([missing, missing]);
  });

  it("re-keys a fieldset under Show keyed", () => {
    const Pair = forms.define({ defaultValues: { a: { text: "first" }, b: { text: "second" } } });
    const Shape = forms.fieldset<{ text: string }>();
    function TextOf(props: { field: ReturnType<typeof Shape.scope>["root"] }) {
      const scope = Shape.scope(props.field);
      return <scope.Field name="text">{(field) => <span>{field.value}</span>}</scope.Field>;
    }
    const [which, setWhich] = createSignal<"a" | "b">("a");
    const { host } = mount(() => {
      const form = createForm(Pair);
      return (
        <Show when={form.root.at(which())} keyed>
          {(handle) => <TextOf field={handle} />}
        </Show>
      );
    });
    expect(host.textContent).toBe("first");
    setWhich("b");
    flush();
    expect(host.textContent).toBe("second");
  });
});
