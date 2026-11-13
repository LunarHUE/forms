import { valibot } from "@lunarhue/forms-schema/valibot";
import { createSignal, Errored, flush, Show } from "solid-js";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createForms, useFormContext, type AnyForm } from "../index.js";
import { getAs, mount, settle } from "./dom.js";

const forms = createForms({ schemas: [valibot()] });
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
  const form = Order.useFormContext();
  return <form.Field name="customer">{(field) => <span data-order={form.id}>{field.value}</span>}</form.Field>;
}

describe("context", () => {
  it("gives a submit button the nearest form, reactively", async () => {
    let form: ReturnType<typeof Order.createForm> | undefined;
    const { host } = mount(() => {
      form = Order.createForm({ id: "order" });
      const f = form;
      return (
        <f.Form>
          {({ submit, ...props }) => (
            <form {...props}>
              <SubmitButton />
              <button type="button" onClick={() => void submit()}>
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
      const order = Order.createForm({ id: "order" });
      const note = Note.createForm({ id: "note" });
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

  it("renders plain children with the context only", () => {
    let seen: AnyForm | undefined;
    function Probe() {
      seen = useFormContext();
      return null;
    }
    let made: unknown;
    mount(() => {
      const note = Note.createForm();
      made = note;
      return (
        <note.Form>
          <Probe />
        </note.Form>
      );
    });
    expect(seen).toBe(made);
  });

  it("throws a clear error with no form.Form above", () => {
    const { host } = mount(() => (
      <>
        <Errored fallback={(error) => <p>{String(error())}</p>}>
          <SubmitButton />
        </Errored>
        <Errored fallback={(error) => <p>{String(error())}</p>}>
          <OrderCustomer />
        </Errored>
      </>
    ));
    const messages = [...host.querySelectorAll("p")].map((p) => p.textContent);
    expect(messages).toEqual([
      "Error: @lunarhue/forms-solid: useFormContext() found no form. Render it inside the form's `form.Form`.",
      "Error: @lunarhue/forms-solid: useFormContext() of a definition found no form. Render it inside the form's `form.Form`.",
    ]);
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
      const form = Pair.createForm();
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
