import { checkboxProps, type HandleOf } from "@lunarhue/forms-solid";
import { rules } from "@lunarhue/forms-solid/plugins";
import { Show } from "solid-js";
import { BillingFieldset } from "./forms";

interface BillingFieldsProps {
  readonly field: HandleOf<typeof BillingFieldset>;
}

export function BillingFields(props: BillingFieldsProps) {
  const scope = BillingFieldset.scope(props.field);
  return (
    <fieldset>
      <legend>Billing</legend>
      <scope.Field name="sameAsShipping">
        {(same) => (
          <label>
            <input {...checkboxProps(same)} />
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
