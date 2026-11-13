import { type AnyHookPlugin, createFormsCore } from "../index.js";
import { benchSchemas, schema } from "./rows.js";

// The rows form from rows.ts, with plugins on its definition. Without
// plugins it is the store as it is today, which is the baseline.

const forms = createFormsCore({ plugins: [benchSchemas], validate: "input" });

/** The rows form with `count` rows and `plugins`, with or without its schema. */
export function pluginRowsForm(count: number, plugins: readonly AnyHookPlugin[], withSchema = true) {
  const defaultValues = { rows: Array.from({ length: count }, (_, i) => ({ name: `row-${i}`, value: "" })) };
  const definition = withSchema ? forms.define({ schema, defaultValues, plugins }) : forms.define({ defaultValues, plugins });
  const store = definition.createStore(undefined, { id: "bench" });
  const list = store.root.at("rows");
  const stops: (() => void)[] = [];
  for (const key of list.peek().keys) {
    const { path } = list.item(key).at("name");
    stops.push(
      store.subscribe(path, () => {
        void store.getSnapshot(path).errors.length;
      }),
    );
  }
  const [firstKey] = list.peek().keys;
  if (firstKey === undefined) throw new Error("The benchmark needs at least one row.");
  return {
    store,
    first: list.item(firstKey).at("name"),
    dispose: () => {
      for (const stop of stops) stop();
    },
  };
}
