import { createForms } from "@lunarhue/forms-react";
import { dirty, history } from "@lunarhue/forms-react/plugins";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

export const forms = createForms({ plugins: [dirty(), history(), docsDevtools], fields: { TextField } });
