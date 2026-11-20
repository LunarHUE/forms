/** @jsxImportSource preact */
import type { JSX } from "preact";
import type { FormEntry } from "../hook.js";
import { fact } from "./fields.js";
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
  return (
    <ol class="plugins scroll" aria-label="Plugins in hook order">
      {entry.ctx.installed.map((plugin, index) => {
        const meta = form.meta?.[plugin.name];
        const keys = apiKeys(entry, plugin.name);
        return (
          <li key={plugin.name} class="plugin" data-plugin={plugin.name}>
            <div class="plugin-head">
              <span class="muted">{String(index + 1)}</span>
              <strong>{plugin.name}</strong>
            </div>
            <div class="facts">
              {fact("form meta", meta === undefined ? <span class="muted">none</span> : <pre>{format(meta)}</pre>)}
              {fact("API", keys.length === 0 ? <span class="muted">none</span> : keys.join(", "))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
