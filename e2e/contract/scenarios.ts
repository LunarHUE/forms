import { arraysScenario } from "./scenarios/arrays.js";
import { asyncScenario } from "./scenarios/async.js";
import { basicScenario } from "./scenarios/basic.js";
import { bindScenario } from "./scenarios/bind.js";
import { dirtyScenario } from "./scenarios/dirty.js";
import { historyScenario } from "./scenarios/history.js";
import { inspectScenario } from "./scenarios/inspect.js";
import { maskScenario } from "./scenarios/mask.js";
import { persistScenario } from "./scenarios/persist.js";
import { rendersScenario } from "./scenarios/renders.js";
import { rulesScenario } from "./scenarios/rules.js";
import { saveScenario } from "./scenarios/save.js";

/** Every scenario, in the order the index lists them. */
export const scenarios = [
  basicScenario,
  arraysScenario,
  rulesScenario,
  saveScenario,
  dirtyScenario,
  asyncScenario,
  rendersScenario,
  historyScenario,
  maskScenario,
  persistScenario,
  bindScenario,
  inspectScenario,
] as const;

export type ScenarioId = (typeof scenarios)[number]["id"];

/** One page component per scenario. An app that leaves one out, or adds one, fails to compile. */
export type Pages<C> = { readonly [K in ScenarioId]: C };

/** The scenario whose route is `path`. */
export const scenarioAt = (path: string): (typeof scenarios)[number] | undefined =>
  scenarios.find((entry) => entry.route === path);
