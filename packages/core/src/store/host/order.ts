import type { AnyHookPlugin } from "../../plugin.js";
import { type HostPart } from "../plugins.js";
import { problem } from "../../problem.js";

/** The part behind `after`: the plugins run in install order, except that each one comes after the names in its `after`. */
export const order: HostPart = (host) => {
  host.order = (plugins) => {
    const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]));
    const ordered: AnyHookPlugin[] = [];
    // False while a plugin's `after` list is being visited, true once the plugin is placed.
    const placed = new Map<AnyHookPlugin, boolean>();
    const visit = (plugin: AnyHookPlugin) => {
      const state = placed.get(plugin);
      if (state) return;
      if (state === false) throw new Error(problem("plugins:cycle", plugin.name));
      placed.set(plugin, false);
      for (const name of plugin.after ?? []) {
        const before = byName.get(name);
        if (before) visit(before);
      }
      placed.set(plugin, true);
      ordered.push(plugin);
    };
    plugins.forEach(visit);
    return ordered;
  };
};
