import { createForms } from "@lunarhue/forms-solid";
import { arrays } from "@lunarhue/forms-solid/plugins";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

export const forms = createForms({ plugins: [arrays(), docsDevtools], fields: { TextField } });

export interface Named {
  id: number;
  name: string;
}

export const NamedFieldset = forms.fieldset<Named>();
