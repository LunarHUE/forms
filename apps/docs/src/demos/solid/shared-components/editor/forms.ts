import { createForms } from "@lunarhue/forms-solid";
import { dirty, history } from "@lunarhue/forms-solid/plugins";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

export const forms = createForms({ plugins: [dirty(), history(), docsDevtools], fields: { TextField } });
