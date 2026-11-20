// The contract every app renders and every spec reads. Nothing here knows a
// framework: apps import it to render the same forms, specs import it to
// find them.
import { valibot } from "@lunarhue/forms-schema/valibot";
import { devtoolsPlugin } from "./devtools.js";

export { devtoolsParam, devtoolsPlugin } from "./devtools.js";
export { delays, fakeServer, takenNames, type ServerCall } from "./fake-server.js";
export { type Capability, type Framework, frameworkNamed, frameworks } from "./frameworks.js";
export {
  appElementId,
  clientEntry,
  indexTitle,
  type RenderedPage,
  type RenderPage,
  statusFor,
  testIds,
} from "./page.js";
export { type ProbeField, type ProbeSource, type ProbeState, readProbe, startProbe } from "./probe.js";
export { countRender } from "./renders.js";
export { type ServerView, statusText, type SubmitLabels } from "./scenario.js";
export { type Pages, type ScenarioId, scenarioAt, scenarios } from "./scenarios.js";
export { arraysScenario } from "./scenarios/arrays.js";
export { asyncScenario } from "./scenarios/async.js";
export { basicScenario } from "./scenarios/basic.js";
export { bindScenario, type Profile } from "./scenarios/bind.js";
export { dirtyScenario } from "./scenarios/dirty.js";
export { historyScenario } from "./scenarios/history.js";
export { maskScenario, phoneMask } from "./scenarios/mask.js";
export { persistScenario } from "./scenarios/persist.js";
export { type Line, type Order, rendersScenario } from "./scenarios/renders.js";
export { type Delivery, rulesScenario } from "./scenarios/rules.js";
export { saveScenario } from "./scenarios/save.js";

/** The plugins every app passes to its one `createForms`. */
export const sharedPlugins = [valibot(), devtoolsPlugin] as const;
