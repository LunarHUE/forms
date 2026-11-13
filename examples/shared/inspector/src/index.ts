// A dev panel for any form store, written in plain DOM so every example app
// mounts the same one. Importing it touches no DOM; call `mountInspector` in
// the browser. It uses the class names from
// `@lunarhue/forms-example-order/styles.css`.
export { mountInspector } from "./inspector.js";
export type { InspectableStore, InspectorOptions } from "./inspector.js";
