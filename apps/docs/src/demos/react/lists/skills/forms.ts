import { createForms } from "@lunarhue/forms-react";
import { arrays } from "@lunarhue/forms-react/plugins";
import { TextField } from "./TextField";

export const forms = createForms({ plugins: [arrays()], fields: { TextField } });

export interface Named {
  id: number;
  name: string;
}

export const NamedFieldset = forms.fieldset<Named>();
