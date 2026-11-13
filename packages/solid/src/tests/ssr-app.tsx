import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { createForm, createForms, useFormContext, type FieldApi } from "../index.js";
import { rules } from "../plugins/rules.js";

function TextField(props: { field: FieldApi<string>; label: string }) {
  return (
    <label>
      {props.label}
      <input {...props.field.inputProps()} />
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
  '<form _hk=100 id="0" novalidate tabindex="-1" data-submits="function">' +
  '<!--$--><label _hk=101><!--$-->Customer<!--/--><input value="Ada" type="text" id="0--customer" name="customer" /></label><!--/-->' +
  '<!--$--><label _hk=10500><!--$-->Title<!--/--><input value="first" type="text" id="0--rows--k0--title" name="rows.0.title" /></label>' +
  '<label _hk=10510><!--$-->Title<!--/--><input value="second" type="text" id="0--rows--k1--title" name="rows.1.title" /></label><!--/-->' +
  "<!--$--><output _hk=107>idle</output><!--/--></form>";

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
      {shippingRules.meta(props.field)?.hidden === true ? null : <input aria-label={props.label} {...props.field.inputProps()} />}
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
