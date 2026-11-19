import { test } from "vitest";
import { createFormsCore, type Part, type Plugins } from "../index.js";
import type { When } from "../plugin.js";
import { history } from "../plugins/history.js";
import { mask, masked, upper } from "../plugins/mask.js";
import { persist } from "../plugins/persist.js";
import { ruled, rules } from "../plugins/rules.js";
import { definePlugin } from "../plugins.js";
import { pluginRowsForm } from "./plugin-rows.js";

// The row benchmark with and without plugins. "zero plugins" is the store as
// it is without the plugin mechanism. Run with
// `bunx vitest bench --run packages/core/src/bench/plugins.bench.ts`.

const noopBefore = (name: string) => definePlugin({ name, setup: () => ({ beforeWrite: (write) => write.value }) });
const noopObserver = (name: string, when: When) => definePlugin({ name, setup: () => ({ when, onWrite: () => {} }) });

const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};

// Item keys are made by the store, so this reads the first one from a store of the same shape.
const firstKey = createFormsCore().define({ defaultValues: { rows: [{ name: "" }] } }).createStore().root.at("rows").peek().keys[0];

const cases: readonly (readonly [label: string, plugins: Plugins, parts?: readonly Part[]])[] = [
  ["zero plugins", []],
  ["one no-op beforeWrite", [noopBefore("before")]],
  ["one deferred no-op observer", [noopObserver("watch", "deferred")]],
  [
    "five mixed no-ops",
    [noopBefore("a"), noopBefore("b"), noopObserver("c", "sync"), noopObserver("d", "deferred"), noopObserver("e", "idle")],
  ],
  [
    "four shipped plugins",
    [mask(), rules(), history(), persist("bench", storage)],
    [
      { ...masked({ clean: upper }), path: `rows.${String(firstKey)}.name` },
      ruled<{ rows: { name: string }[] }>({ rows: (value) => ({ hidden: value.rows[0]?.name === "HIDE" }) }),
    ],
  ],
];

for (const count of [200, 1000]) {
  test(`${count} rows`, async ({ bench }) => {
    for (const [label, plugins, parts] of cases) {
      const form = pluginRowsForm(count, plugins, true, parts);
      let flip = false;
      await bench(`${label} (${count} rows)`, async () => {
        flip = !flip;
        form.first.setValue(flip ? "" : "x");
        await Promise.resolve();
      }).run();
      form.dispose();
    }
  });
}

const burstCases = cases.filter(([label]) => label === "zero plugins" || label === "one deferred no-op observer");

// Without a schema too, since with one each write in the batch runs it over every row, which hides the rest.
for (const withSchema of [true, false]) {
  const suffix = withSchema ? "" : ", no schema";
  test(`burst: 1000 writes in one batch${suffix}`, async ({ bench }) => {
    for (const [label, plugins] of burstCases) {
      const form = pluginRowsForm(1000, plugins, withSchema);
      const list = form.store.root.at("rows");
      const handles = list.peek().keys.map((key) => list.item(key).at("value"));
      let flip = false;
      await bench(`${label} (burst of 1000${suffix})`, async () => {
        flip = !flip;
        const text = flip ? "y" : "";
        form.store.batch(() => {
          for (const handle of handles) handle.setValue(text);
        });
        await Promise.resolve();
      }).run();
      form.dispose();
    }
  });
}
