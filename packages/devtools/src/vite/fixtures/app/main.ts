import { createFormsCore } from "@lunarhue/forms-core";
import { history, mask } from "@lunarhue/forms-core/plugins";
import { devtools } from "@lunarhue/forms-devtools";

const store = createFormsCore({ plugins: [history(), mask(), devtools()] })
  .define({ defaultValues: { name: "" } })
  .createStore();
console.log(store);
