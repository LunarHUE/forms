import { h, type JSX } from "preact";
import type { FormEntry } from "../hook.js";
import { useFrame } from "./frame.js";
import { format } from "./values.js";

/** The keys of a plugin's API on `store.plugins`, or none. */
export function apiKeys(entry: FormEntry, name: string): string[] {
  const apis: unknown = entry.store.plugins;
  if (apis === null || typeof apis !== "object") return [];
  const api: unknown = Reflect.get(apis, name);
  return api !== null && typeof api === "object" ? Object.keys(api) : [];
}

/** The Plugins tab: every plugin on the form in the order their hooks run, with each one's form meta and API. */
export function Plugins({ entry }: { readonly entry: FormEntry }): JSX.Element {
  const form = entry.store.getFormSnapshot();
  useFrame(() => [entry.store.getFormSnapshot()]);
  return h(
    "ol",
    { class: "plugins scroll", "aria-label": "Plugins in hook order" },
    entry.ctx.installed.map((plugin, index) => {
      const meta = form.meta?.[plugin.name];
      const keys = apiKeys(entry, plugin.name);
      return h(
        "li",
        { key: plugin.name, class: "plugin", "data-plugin": plugin.name },
        h("div", { class: "plugin-head" }, h("span", { class: "muted" }, String(index + 1)), h("strong", null, plugin.name)),
        h(
          "dl",
          { class: "facts" },
          h("dt", null, "form meta"),
          h("dd", null, meta === undefined ? h("span", { class: "muted" }, "none") : h("pre", null, format(meta))),
          h("dt", null, "API"),
          h("dd", null, keys.length === 0 ? h("span", { class: "muted" }, "none") : keys.join(", ")),
        ),
      );
    }),
  );
}
