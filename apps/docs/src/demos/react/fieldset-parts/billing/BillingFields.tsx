import { checkboxProps, type HandleOf } from "@lunarhue/forms-react";
import { rules } from "@lunarhue/forms-react/plugins";
import { BillingFieldset } from "./forms";

interface BillingFieldsProps {
  readonly field: HandleOf<typeof BillingFieldset>;
}

export function BillingFields({ field }: BillingFieldsProps) {
  const scope = BillingFieldset.scope(field);
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
        {(address) =>
          rules.meta(address).hidden ? null : (
            <>
              <scope.TextField name="address.street" label="Billing street" />
              <scope.TextField name="address.city" label="Billing city" />
            </>
          )
        }
      </scope.Field>
    </fieldset>
  );
}
