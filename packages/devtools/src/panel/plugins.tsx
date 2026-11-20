/** @jsxImportSource preact */
import type { JSX } from "preact";
import type { FormEntry } from "../hook.js";
import { scroll } from "./classes.js";
import { Fact, facts } from "./fields.js";
import { useFrame } from "./frame.js";
import { format } from "./values.js";

/** The keys of a plugin's API on `store.plugins`, or none. */
export function apiKeys(entry: FormEntry, name: string): string[] {
  const apis: unknown = entry.store.plugins;
  if (apis === null || typeof apis !== "object") return [];
  const api: unknown = Reflect.get(apis, name);
  return api !== null && typeof api === "object" ? Object.keys(api) : [];
}

export interface PluginsProps {
  readonly entry: FormEntry;
}

/** The Plugins tab: every plugin on the form in the order their hooks run, with each one's form meta and API. */
export function Plugins({ entry }: PluginsProps): JSX.Element {
  const form = entry.store.getFormSnapshot();
  useFrame(() => [entry.store.getFormSnapshot()]);
  return (
    <ol class={`${scroll} m-0 py-2 px-0 list-none`} aria-label="Plugins in hook order">
      {entry.ctx.installed.map((plugin, index) => {
        const meta = form.meta?.[plugin.name];
        const keys = apiKeys(entry, plugin.name);
        return (
          <li key={plugin.name} class={index === 0 ? "plugin" : "plugin border-t border-line"} data-plugin={plugin.name}>
            <div class="flex gap-3 pt-3 px-4 pb-0">
              <span class="w-4 font-sans text-muted">{String(index + 1)}</span>
              <strong>{plugin.name}</strong>
            </div>
            <div class={facts}>
              <Fact term="form meta">{meta === undefined ? <span class="text-muted">none</span> : <pre>{format(meta)}</pre>}</Fact>
              <Fact term="API">{keys.length === 0 ? <span class="text-muted">none</span> : keys.join(", ")}</Fact>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
