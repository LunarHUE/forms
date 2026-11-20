import { type HandleOf, inputProps } from "@lunarhue/forms-solid";
import { rules } from "@lunarhue/forms-solid/plugins";
import { Show } from "solid-js";
import { BillingFieldset } from "./forms";

export function BillingFields(props: { field: HandleOf<typeof BillingFieldset> }) {
  const scope = BillingFieldset.scope(props.field);
  return (
    <fieldset>
      <legend>Billing</legend>
      <scope.Field name="sameAsShipping">
        {(same) => (
          <label>
            <input {...inputProps(same, { kind: "checkbox" })} />
            Same as shipping
          </label>
        )}
      </scope.Field>
      {/* The rule hides `address`. The component decides what hidden means. */}
      <scope.Field name="address">
        {(address) => (
          <Show when={!rules.meta(address).hidden}>
            <scope.TextField name="address.street" label="Billing street" />
            <scope.TextField name="address.city" label="Billing city" />
          </Show>
        )}
      </scope.Field>
    </fieldset>
  );
}
