// One `createForms` for the whole back office. Every form gets the same
// plugins and field types, and the save bar and error summary work on any
// of them through `useFormContext(forms)`.
import { createForms, defineField } from "@lunarhue/forms-react";
import { arrays, dirty, history, mask, masked, rebase, ruled, rules } from "@lunarhue/forms-react/plugins";
import { zod } from "@lunarhue/forms-schema/zod";
import { cleanMoney, digitsOnly, formatMoney, formatPhone, formatTaxId } from "../format.ts";
import { Address } from "../schemas.ts";
import { Checkbox, MaskedInput, Select, TextArea, TextField } from "./fields.tsx";

// Kept apart so the undo button can read its form meta.
export const undoHistory = history();

// Each masked type stores the clean value and shows it formatted.
const PhoneField = defineField(MaskedInput, masked({ clean: digitsOnly(10), display: formatPhone }));
const TaxIdField = defineField(MaskedInput, masked({ clean: digitsOnly(9), display: formatTaxId }));
const MoneyField = defineField(MaskedInput, masked({ clean: cleanMoney, display: formatMoney }));
const QuantityField = defineField(MaskedInput, masked({ clean: digitsOnly(4) }));

export const forms = createForms({
  plugins: [zod(), dirty(), rebase(), rules(), mask(), arrays(), undoHistory],
  fields: { TextField, TextArea, Select, Checkbox, PhoneField, TaxIdField, MoneyField, QuantityField },
});

// Every address, wherever it sits, shows the region only for the US.
export const AddressFieldset = forms.fieldset(Address, ruled({ region: (address) => ({ hidden: address.country !== "US" }) }));
