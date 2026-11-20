import { createForms } from "@lunarhue/forms-react";
import { dirty, history } from "@lunarhue/forms-react/plugins";
import { TextField } from "./TextField";
import { docsDevtools } from "@/devtools/enabled";

// Keep the object `history()` returns for its `formMeta` reader.
export const undoHistory = history();

export const forms = createForms({ plugins: [dirty(), undoHistory, docsDevtools], fields: { TextField } });
