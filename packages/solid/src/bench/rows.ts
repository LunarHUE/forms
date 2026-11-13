import { createFormsCore, type AnyFormStore, type FieldSnapshot, type Path } from "@lunarhue/forms-core";
import { valibot } from "@lunarhue/forms-schema/valibot";
import { createEffect, createRoot, createSignal, flush, onCleanup } from "solid-js";
import { createField } from "../field.js";
import * as v from "valibot";

// The row benchmark from solid-form, with Solid signals built on the store's
// `subscribe`: a form with `count` array rows and one error effect per row,
// as a list of row components would have. The `adapter` bridge reads each
// row through the adapter's `createField` instead of the signal here.
const schema = v.object({
  rows: v.array(v.object({ name: v.pipe(v.string(), v.minLength(1, "Required")), value: v.string() })),
});

// The old form ran its schema on every write, so this one validates on input.
const Form = createFormsCore({ schemas: [valibot()], validate: "input" }).define((count: number) => ({
  schema,
  defaultValues: { rows: Array.from({ length: count }, (_, i) => ({ name: `row-${i}`, value: "" })) },
}));

// The least an adapter needs: a signal holding the field's snapshot, set from
// the store's listener. The subscription ends with the owner.
function fieldSignal(store: AnyFormStore, path: Path): () => FieldSnapshot<unknown> {
  const [snapshot, setSnapshot] = createSignal(store.getSnapshot(path));
  onCleanup(store.subscribe(path, () => setSnapshot(() => store.getSnapshot(path))));
  return snapshot;
}

/** How a row reads its name field's error count: the hand-written signal, or the adapter's `createField`. */
export type RowBridge = "signal" | "adapter";

export function rowsForm(count: number, bridge: RowBridge = "signal") {
  return createRoot((dispose) => {
    const store = Form.createStore(count, { id: "bench" });
    const list = store.root.at("rows");
    const runs = { errors: 0 };
    for (const key of list.peek().keys) {
      const name = list.item(key).at("name");
      let errorCount: () => number;
      if (bridge === "signal") {
        const snapshot = fieldSignal(store, name.path);
        errorCount = () => snapshot().errors.length;
      } else {
        const field = createField(name);
        errorCount = () => field.errors.length;
      }
      createEffect(errorCount, () => void runs.errors++);
    }
    flush();
    runs.errors = 0;
    const [firstKey] = list.peek().keys;
    if (firstKey === undefined) throw new Error("The benchmark needs at least one row.");
    const first = list.item(firstKey).at("name");
    return { store, first, runs, dispose };
  });
}

/** One keystroke on the first row's name, then the effects settle. */
export async function keystroke(form: ReturnType<typeof rowsForm>, text: string): Promise<void> {
  form.first.setValue(text);
  await Promise.resolve();
  flush();
}
