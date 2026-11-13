import { valibot } from "@lunarhue/forms-schema/valibot";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createForms, type FieldApi, type HandleOf } from "../index.js";
import { get, mount, settle, typeText } from "./dom.js";

const bodies = { text: 0, number: 0, address: 0 };

function TextField(props: { field: FieldApi<string>; label: string }) {
  bodies.text++;
  return (
    <label>
      {props.label}
      <input data-label={props.label} {...props.field.inputProps()} />
    </label>
  );
}

function NumberField(props: { field: FieldApi<number>; label: string }) {
  bodies.number++;
  return (
    <label>
      {props.label}
      <input data-label={props.label} {...props.field.inputProps({ kind: "number" })} />
    </label>
  );
}

const forms = createForms({ schemas: [valibot()], fields: { TextField, NumberField } });

const AddressSchema = v.object({
  street: v.string(),
  city: v.pipe(v.string(), v.minLength(1, "Required")),
  geo: v.object({ lat: v.number() }),
});
const Address = forms.fieldset(AddressSchema);
const Geo = forms.fieldset<{ lat: number | undefined }>();

function GeoFields(props: { field: HandleOf<typeof Geo>; prefix: string }) {
  const scope = Geo.scope(props.field);
  return <scope.NumberField name="lat" label={`${props.prefix} lat`} />;
}

function AddressFields(props: { field: HandleOf<typeof Address>; title: string }) {
  bodies.address++;
  const scope = Address.scope(props.field);
  return (
    <fieldset>
      <legend>{props.title}</legend>
      <scope.TextField name="street" label={`${props.title} street`} />
      <scope.Field name="city">{(field) => <input data-label={`${props.title} city`} {...field.inputProps()} />}</scope.Field>
      <GeoFields field={scope.root.at("geo")} prefix={props.title} />
    </fieldset>
  );
}

const Order = forms.define({
  schema: v.object({
    customer: v.string(),
    qty: v.number(),
    billing: AddressSchema,
    shipping: AddressSchema,
    rows: v.array(v.object({ qty: v.number(), address: AddressSchema })),
  }),
  defaultValues: { rows: [{ qty: 1, address: { street: "", city: "", geo: { lat: 0 } } }] },
});
type OrderForm = ReturnType<typeof Order.createForm>;

function mountOrder() {
  let form: OrderForm | undefined;
  const { host } = mount(() => {
    form = Order.createForm();
    const f = form;
    return (
      <f.Form>
        {(props) => (
          <form {...props}>
            <f.TextField name="customer" label="Customer" />
            <f.NumberField handle={f.root.at("qty")} label="Qty" />
            <AddressFields field={f.root.at("billing")} title="Billing" />
            <AddressFields field={f.root.at("shipping")} title="Shipping" />
            <f.Items name="rows">
              {(row, index) => (
                <div>
                  <f.NumberField handle={row.at("qty")} label={`Row qty`} />
                  <AddressFields field={row.at("address")} title={`Row ${index()}`} />
                </div>
              )}
            </f.Items>
          </form>
        )}
      </f.Form>
    );
  });
  if (!form) throw new Error("The form was not created.");
  return { form, host };
}

describe("fieldsets and scopes", () => {
  it("renders the same fieldset at two paths, in a row, and nested", async () => {
    const { form, host } = mountOrder();
    typeText(get(host, "[data-label='Billing street']"), "1 Main St");
    typeText(get(host, "[data-label='Shipping city']"), "Oslo");
    typeText(get(host, "[data-label='Row 0 street']"), "Row road");
    typeText(get(host, "[data-label='Shipping lat']"), "59.9");
    await settle();
    const value = form.store.root.peek().value;
    expect(value.billing.street).toBe("1 Main St");
    expect(value.shipping.street).toBe("");
    expect(value.shipping.city).toBe("Oslo");
    expect(value.shipping.geo.lat).toBe(59.9);
    expect(value.rows[0]?.address.street).toBe("Row road");
    expect(get(host, "[data-label='Shipping lat']").name).toBe("shipping.geo.lat");
    expect(get(host, "[data-label='Row 0 street']").name).toBe("rows.0.address.street");
  });

  it("validates with the form's schema, and registers nothing of its own", async () => {
    const { form } = mountOrder();
    const city = form.root.at("billing").at("city");
    expect(await form.store.validate()).toBe(false);
    expect(city.peek().errors).toEqual([{ message: "Required" }]);
    city.setValue("Bergen");
    await form.root.at("billing").validate();
    expect(city.peek().errors).toEqual([]);
  });

  it("binds registered components by name and by handle", async () => {
    const { form, host } = mountOrder();
    typeText(get(host, "[data-label=Customer]"), "Ada");
    typeText(get(host, "[data-label=Qty]"), "3");
    typeText(get(host, "[data-label='Row qty']"), "4");
    await settle();
    expect(form.root.at("customer").peek().value).toBe("Ada");
    expect(form.root.at("qty").peek().value).toBe(3);
    expect(form.root.at("rows").peek().value[0]?.qty).toBe(4);
  });

  it("runs component bodies once while fields change", async () => {
    bodies.text = 0;
    bodies.number = 0;
    bodies.address = 0;
    const { host } = mountOrder();
    const before = { ...bodies };
    typeText(get(host, "[data-label='Billing street']"), "x");
    typeText(get(host, "[data-label=Qty]"), "9");
    await settle();
    expect(bodies).toEqual(before);
    expect(before.address).toBe(3);
  });

  it("returns the same scope for the same handle", () => {
    mount(() => {
      const form = Order.createForm();
      const billing = form.root.at("billing");
      expect(forms.scope(billing)).toBe(Address.scope(billing));
      expect(Address.scope(billing).TextField).toBe(forms.scope(billing).TextField);
      expect(forms.scope(form.root).Field).toBe(form.Field);
      return null;
    });
  });
});
