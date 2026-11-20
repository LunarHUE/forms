import type { Hook } from "./hook.js";

/**
 * Mounts the panel for `hook` and returns the function that unmounts it.
 * The collector imports this module the first time the hook turns on, so
 * the panel is a chunk of its own. For now it mounts an empty host with a
 * shadow root.
 */
export function mount(_hook: Hook): () => void {
  const host = document.createElement("div");
  host.setAttribute("data-lunarhue-forms-devtools", "");
  host.attachShadow({ mode: "open" });
  document.body.append(host);
  return () => host.remove();
}
