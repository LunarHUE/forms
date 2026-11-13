import { createFormsCore } from "../index.js";
import type { StandardSchemaV1 } from "../standard-schema.js";

// The row benchmark from solid-form, on the plain store: a form with `count`
// array rows and one listener per row on that row's name errors, as a list of
// row components would have.

interface Row {
  name: string;
  value: string;
}

interface Rows {
  rows: Row[];
}

// A hand-written Standard Schema with the old benchmark's rule: every name is required.
export const schema: StandardSchemaV1<Rows> = {
  "~standard": {
    version: 1,
    vendor: "bench",
    validate(value) {
      // The store only ever passes the form value, which has this shape.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const { rows } = value as Rows;
      const issues: StandardSchemaV1.Issue[] = [];
      for (let i = 0; i < rows.length; i++)
        if (rows[i]?.name === "") issues.push({ message: "Required", path: ["rows", i, "name"] });
      // The value passed every check, so it is a `Rows`.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return issues.length > 0 ? { issues } : { value: value as Rows };
    },
  },
};

// The old form ran its schema on every write, so this one validates on input.
const Form = createFormsCore({ validate: "input" }).define((count: number) => ({
  schema,
  defaultValues: { rows: Array.from({ length: count }, (_, i) => ({ name: `row-${i}`, value: "" })) },
}));

export function rowsForm(count: number) {
  const store = Form.createStore(count, { id: "bench" });
  const list = store.root.at("rows");
  const runs = { errors: 0 };
  const stops: (() => void)[] = [];
  for (const key of list.peek().keys) {
    const { path } = list.item(key).at("name");
    stops.push(
      store.subscribe(path, () => {
        // Read what a row's error effect would read.
        void store.getSnapshot(path).errors.length;
        runs.errors++;
      }),
    );
  }
  const [firstKey] = list.peek().keys;
  if (firstKey === undefined) throw new Error("The benchmark needs at least one row.");
  const first = list.item(firstKey).at("name");
  const dispose = () => {
    for (const stop of stops) stop();
  };
  return { store, first, runs, dispose };
}

/** One keystroke on the first row's name. The schema and the listeners run before `setValue` returns. */
export function keystroke(form: ReturnType<typeof rowsForm>, text: string): void {
  form.first.setValue(text);
}
