import type { HandleOf } from "@lunarhue/forms-solid";
import { Address, forms } from "./forms";

// A token for the address shape. It types the handle this component takes.
const AddressFieldset = forms.fieldset(Address);

interface AddressFieldsProps {
  readonly field: HandleOf<typeof AddressFieldset>;
  readonly legend: string;
}

// Any handle to an address fits, so the same component renders both. Names
// in the scope are relative: `name="city"` here is `shipping.city` or
// `billing.city`.
export function AddressFields(props: AddressFieldsProps) {
  const scope = AddressFieldset.scope(props.field);
  return (
    <fieldset>
      <legend>{props.legend}</legend>
      <scope.TextField name="street" label="Street" />
      <scope.TextField name="city" label="City" />
    </fieldset>
  );
}
