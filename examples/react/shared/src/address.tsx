import { countries } from "@lunarhue/forms-example-order";
import { errorId, type HandleOf, useField, useFormContext, useInputProps } from "@lunarhue/forms-react";
import { RenderBadge, useRenderBadge } from "./badge.js";
import { FieldErrors } from "./fields.js";
import { AddressFieldset, order } from "./order.js";

/** Props for `AddressFields`. */
export interface AddressFieldsProps {
  /**
   * The handle of an address in any form made by `forms`:
   * `form.root.at("billing")`, `form.root.at("shipping")`, or an address
   * inside an array item.
   */
  readonly field: HandleOf<typeof AddressFieldset>;
  readonly legend: string;
}

/**
 * One address. It is a plain component written once and used for both
 * billing and shipping. `AddressFieldset.scope(handle)` returns the bound
 * components rooted at that address, so `name="city"` means `billing.city`
 * in one place and `shipping.city` in the other. The scope is a cached
 * lookup, not a hook, so calling it on every render is free.
 */
export function AddressFields({ field, legend }: AddressFieldsProps) {
  const scope = AddressFieldset.scope(field);
  const badge = useRenderBadge();
  return (
    <fieldset className="fieldset">
      <legend>
        {legend} <RenderBadge counter={badge} name={`${legend} fieldset`} />
      </legend>
      {/* Registered components, bound to the scope. */}
      <scope.TextField name="street" label="Street" autoComplete="street-address" />
      <div className="field-grid">
        <scope.TextField name="city" label="City" autoComplete="address-level2" />
        <scope.TextField name="postcode" label="Postcode" autoComplete="postal-code" />
      </div>
      <scope.SelectField name="country" label="Country" options={countries} />
    </fieldset>
  );
}

/**
 * The "same as billing" checkbox, built from hooks and a handle instead of
 * a bound component: `useInputProps` gives the checkbox its props, and
 * `useField` reads the errors.
 *
 * Ticking it disables the whole shipping address. The checkbox only writes
 * the value: a `rules` entry on the order definition sets the flag. The
 * disabled shipping address keeps its values and still counts for
 * validation, so an invalid one blocks the submit and shows up in the
 * "disabled fields" list.
 */
export function SameAsBilling() {
  const form = useFormContext(order);
  const same = form.root.at("sameAsBilling");
  const input = useInputProps(same, { kind: "checkbox" });
  const errors = useField(same, (snapshot) => snapshot.shownErrors);
  const badge = useRenderBadge();
  return (
    <div className="field">
      <div className="field-check">
        <input {...input} />
        <label htmlFor={input.id}>Ship to the billing address</label>
        <RenderBadge counter={badge} name={input.name} />
      </div>
      <FieldErrors id={errorId(same)} errors={errors} />
    </div>
  );
}
