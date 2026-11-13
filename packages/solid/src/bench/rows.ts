import { createFormsCore, type AnyFormStore, type FieldSnapshot, type Path } from "@lunarhue/forms-core";
import { valibot } from "@lunarhue/forms-valibot";
import { createEffect, createRoot, createSignal, flush, onCleanup } from "solid-js";
import * as v from "valibot";

// The row benchmark from solid-form, with Solid signals built on the store's
// `subscribe`: a form with `count` array rows and one error effect per row,
// as a list of row components would have.
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

export function rowsForm(count: number) {
  return createRoot((dispose) => {
    const store = Form.createStore(count, { id: "bench" });
    const list = store.root.at("rows");
    const runs = { errors: 0 };
    for (const key of list.peek().keys) {
      const snapshot = fieldSignal(store, list.item(key).at("name").path);
      createEffect(
        () => snapshot().errors.length,
        () => void runs.errors++,
      );
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
