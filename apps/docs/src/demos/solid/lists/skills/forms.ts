import { createForms } from "@lunarhue/forms-solid";
import { arrays } from "@lunarhue/forms-solid/plugins";
import { TextField } from "./TextField";

export const forms = createForms({ plugins: [arrays()], fields: { TextField } });

export interface Named {
  id: number;
  name: string;
}

export const NamedFieldset = forms.fieldset<Named>();
