import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { createForm, createForms, createInputProps, inputProps, useFormContext, type FieldApi } from "../index.js";
import { digits, mask, rules } from "../plugins.js";

function TextField(props: { field: FieldApi<string>; label: string }) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field)} />
    </label>
  );
}

const forms = createForms({ plugins: [valibot()], fields: { TextField } });
const Order = forms.define({
  schema: v.object({ customer: v.string(), rows: v.array(v.object({ title: v.string() })) }),
  defaultValues: { customer: "Ada", rows: [{ title: "first" }, { title: "second" }] },
});

function Status() {
  const form = useFormContext();
  return <output>{form.state.submission.status}</output>;
}

export function App() {
  const form = createForm(Order);
  return (
    <form.Form>
      {(props, owner) => (
        <form {...props} data-submits={typeof owner.submit}>
          <form.TextField name="customer" label="Customer" />
          <form.Items name="rows">{(row) => <form.TextField handle={row.at("title")} label="Title" />}</form.Items>
          <Status />
        </form>
      )}
    </form.Form>
  );
}

// What the server renders for `App`. The server test checks that
// `renderToString` gives exactly this, and the hydration test hydrates it.

/** The app's markup, as `renderToString` returns it without the hydration script. */
export const serverHtml =
  '<form _hk=10 id="0" novalidate tabindex="-1" data-submits="function">' +
  '<!--$--><label _hk=11><!--$-->Customer<!--/--><input value="Ada" type="text" id="0--customer" name="customer" /></label><!--/-->' +
  '<!--$--><label _hk=1500><!--$-->Title<!--/--><input value="first" type="text" id="0--rows--k0--title" name="rows.0.title" /></label>' +
  '<label _hk=1510><!--$-->Title<!--/--><input value="second" type="text" id="0--rows--k1--title" name="rows.1.title" /></label><!--/-->' +
  "<!--$--><output _hk=17>idle</output><!--/--></form>";

interface Shipping {
  sameAsBilling: boolean;
  gift: boolean;
  street: string;
  note: string;
}

/** Disables `street` and hides `note` from the start, so the server must render both that way. */
const shippingRules = rules<Shipping>({
  street: (value) => ({ disabled: value.sameAsBilling }),
  note: (value) => ({ hidden: !value.gift }),
});

interface RuledTextProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

/** A text input that renders nothing while `rules` hides its field. */
function RuledText(props: RuledTextProps) {
  return (
    <>
      {shippingRules.meta(props.field).hidden ? null : <input aria-label={props.label} {...inputProps(props.field)} />}
    </>
  );
}

const Shipment = createForms({ fields: { RuledText } }).define({
  defaultValues: { sameAsBilling: true, gift: false, street: "1 Main St", note: "" },
  plugins: [shippingRules],
});

export function ShippingApp() {
  const form = createForm(Shipment, { id: "shipping" });
  return (
    <form {...form.formProps}>
      <form.RuledText name="street" label="street" />
      <form.RuledText name="note" label="note" />
    </form>
  );
}

/** `ShippingApp`'s markup, as `renderToString` returns it: `street` disabled and `note` absent. */
export const shippingHtml =
  '<form _hk=0 id="shipping" novalidate tabindex="-1">' +
  '<!--$--><input _hk=11 aria-label="street" value="1 Main St" type="text" id="shipping--street" name="street" disabled /><!--/-->' +
  "<!--$--><!--/--></form>";

interface Delivery {
  sameAsBilling: boolean;
  note: string;
  shipping: { street: string };
}

interface LabeledTextProps {
  readonly field: FieldApi<string>;
  readonly label: string;
}

function LabeledText(props: LabeledTextProps) {
  return <input aria-label={props.label} {...inputProps(props.field)} />;
}

const Deliveries = createForms({ fields: { LabeledText } }).define({
  defaultValues: { sameAsBilling: true, note: "", shipping: { street: "1 Main St" } },
  plugins: [rules<Delivery>({ shipping: (value) => ({ disabled: value.sameAsBilling }) })],
});

/** Writes `note` before `shipping.street` is first read, so the street's server snapshot is built after a change. */
export function DeliveryApp() {
  const form = createForm(Deliveries, { id: "delivery" });
  form.root.at("note").setValue("typed");
  return (
    <form {...form.formProps}>
      <form.LabeledText name="shipping.street" label="street" />
    </form>
  );
}

/** `DeliveryApp`'s markup, as `renderToString` returns it: `street` disabled through its parent. */
export const deliveryHtml =
  '<form _hk=0 id="delivery" novalidate tabindex="-1">' +
  '<input _hk=1 aria-label="street" value="1 Main St" type="text" id="delivery--shipping--street" name="shipping.street" disabled /></form>';

/** Shows "5551234" as "(555) 123-4". */
export function formatPhone(value: string): string {
  if (value.length > 6) return `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
  if (value.length > 3) return `(${value.slice(0, 3)}) ${value.slice(3)}`;
  return value;
}

const Contact = createForms().define({
  defaultValues: { phone: "555 1234" },
  plugins: [mask({ phone: { clean: digits, display: formatPhone } })],
});

/** A phone input whose mask gives it display text, so the server must render that text. */
export function PhoneApp() {
  const form = createForm(Contact);
  return <input aria-label="phone" {...createInputProps(form.root.at("phone"), { type: "tel" })} />;
}

/** `PhoneApp`'s markup, as `renderToString` returns it. */
export const phoneHtml = '<input _hk=1 aria-label="phone" value="(555) 123-4" type="tel" id="0--phone" name="phone" />';
