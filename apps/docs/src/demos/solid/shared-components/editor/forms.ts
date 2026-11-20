import { createForms } from "@lunarhue/forms-solid";
import { dirty, history } from "@lunarhue/forms-solid/plugins";
import { TextField } from "./TextField";

// Keep the object `history()` returns for its `formMeta` reader.
export const undoHistory = history();

export const forms = createForms({ plugins: [dirty(), undoHistory], fields: { TextField } });
