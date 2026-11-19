import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { Items, createForms, type FieldApi, type FormOf, type HandleOf, inputProps, useForm } from "./index.js";
import { arrays } from "./plugins.js";

function TextField(props: { readonly field: FieldApi<string>; readonly label: string }) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field)} />
    </label>
  );
}

function NumberField(props: { readonly field: FieldApi<number>; readonly label: string }) {
  return (
    <label>
      {props.label}
      <input {...inputProps(props.field, { kind: "number" })} />
    </label>
  );
}

const forms = createForms({ plugins: [arrays()], fields: { TextField, NumberField } });

interface Geo {
  lat: number | undefined;
}
interface Address {
  street: string;
  geo: Geo;
}
const GeoShape = forms.fieldset<Geo>();
const AddressShape = forms.fieldset<Address>();

function GeoFields(props: { readonly field: HandleOf<typeof GeoShape>; readonly title: string }) {
  const scope = GeoShape.scope(props.field);
  return <scope.NumberField name="lat" label={`${props.title} lat`} />;
}

function AddressFields(props: { readonly field: HandleOf<typeof AddressShape>; readonly title: string }) {
  const scope = AddressShape.scope(props.field);
  return (
    <fieldset>
      <scope.TextField name="street" label={`${props.title} street`} />
      <GeoFields field={scope.root.at("geo")} title={props.title} />
    </fieldset>
  );
}

const address = (street: string): Address => ({ street, geo: { lat: undefined } });
const trip = forms.define({
  defaultValues: { billing: address("Main"), shipping: address("Side"), stops: [address("A"), address("B"), address("C")] },
});
type TripForm = FormOf<typeof trip>;
const holder: { form?: TripForm } = {};
const current = (): TripForm => {
  if (holder.form === undefined) throw new Error("no form rendered");
  return holder.form;
};

function Trip() {
  const form = useForm(trip, { id: "trip" });
  useEffect(() => {
    holder.form = form;
  });
  return (
    <form.Form>
      <AddressFields field={form.root.at("billing")} title="Billing" />
      <AddressFields field={form.root.at("shipping")} title="Shipping" />
      <Items handle={form.root.at("stops")}>
        {(stop, index) => (
          <div data-testid="stop">
            <AddressFields field={stop} title={`Stop ${stop.key}`} />
            <input aria-label={`note ${stop.key}`} defaultValue="" data-index={index} />
          </div>
        )}
      </Items>
    </form.Form>
  );
}

const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);

function ByHandle() {
  const form = useForm(trip);
  const geo = form.root.at("billing").at("geo");
  return (
    <>
      <form.NumberField handle={geo.at("lat")} label="lat" />
      <form.TextField handle={form.root.at("billing").at("street")} label="street" />
    </>
  );
}

describe("fieldsets and scopes", () => {
  it("binds the same fieldset at two paths, in rows and nested", () => {
    render(<Trip />);
    expect(input("Billing street").value).toBe("Main");
    expect(input("Shipping street").value).toBe("Side");
    expect(input("Billing street").name).toBe("billing.street");
    fireEvent.change(input("Shipping street"), { target: { value: "Elm" } });
    fireEvent.change(input("Billing lat"), { target: { value: "59.3" } });
    const value = current().root.peek().value;
    expect(value.shipping.street).toBe("Elm");
    expect(value.billing).toEqual({ street: "Main", geo: { lat: 59.3 } });
    const [first] = current().root.at("stops").peek().keys;
    fireEvent.change(input(`Stop ${first} street`), { target: { value: "Z" } });
    expect(current().root.peek().value.stops[0]?.street).toBe("Z");
    expect(input(`Stop ${first} lat`).name).toBe("stops.0.geo.lat");
  });

  it("returns the same scope and components for one handle", () => {
    render(<Trip />);
    const billing = current().root.at("billing");
    const scope = forms.scope(billing);
    expect(AddressShape.scope(billing)).toBe(scope);
    expect(forms.scope(billing).TextField).toBe(scope.TextField);
    expect(forms.scope(current().root)).not.toBe(scope);
    expect(current().TextField).toBe(forms.scope(current().root).TextField);
  });

  it("binds registered components by handle", () => {
    render(<ByHandle />);
    fireEvent.change(input("lat"), { target: { value: "3" } });
    expect(input("lat").value).toBe("3");
    expect(input("street").value).toBe("Main");
  });
});

describe("arrays keep each row's DOM node and input state", () => {
  it("push, remove and move", () => {
    render(<Trip />);
    const stops = current().root.at("stops");
    const [a, b, c] = stops.peek().keys;
    const node = (key: string | undefined) => input(`note ${key}`);
    const nodeA = node(a);
    const nodeB = node(b);
    const nodeC = node(c);
    fireEvent.change(nodeA, { target: { value: "first" } });
    fireEvent.change(nodeC, { target: { value: "third" } });

    act(() => stops.move(0, 2));
    expect(node(a)).toBe(nodeA);
    expect(nodeA.value).toBe("first");
    expect(screen.getAllByTestId("stop").map((row) => row.querySelector("[data-index]")?.getAttribute("aria-label"))).toEqual([
      `note ${b}`,
      `note ${c}`,
      `note ${a}`,
    ]);
    expect(input(`Stop ${a} street`).name).toBe("stops.2.street");

    act(() => stops.remove(0));
    expect(nodeB.isConnected).toBe(false);
    expect(node(c)).toBe(nodeC);
    expect(nodeC.value).toBe("third");

    act(() => stops.push(address("D")));
    expect(node(a)).toBe(nodeA);
    expect(screen.getAllByTestId("stop")).toHaveLength(3);
    const d = stops.peek().keys[2];
    expect(input(`Stop ${d} street`).value).toBe("D");
  });
});
