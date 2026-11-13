// A dev panel for any form store, written in plain DOM so any framework can
// mount it. Importing it touches no DOM; call `mountInspector` in the
// browser. Its class names are styled by `./styles.css`. The React wrapper
// is the `./react` entry.
export { mountInspector } from "./inspector.js";
export type { InspectableStore, InspectorOptions } from "./inspector.js";
export { createServerSettings, normalDelayMs, slowDelayMs } from "./settings.js";
export type { ServerSettings, ServerSettingsState } from "./settings.js";
