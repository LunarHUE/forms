import { indexTitle, type Pages, scenarioAt, scenarios } from "@lunarhue/forms-e2e/contract";
import type { ComponentType } from "react";
import { ArraysPage } from "./pages/arrays.js";
import { AsyncPage } from "./pages/async.js";
import { BasicPage } from "./pages/basic.js";
import { BindPage } from "./pages/bind.js";
import { DirtyPage } from "./pages/dirty.js";
import { HistoryPage } from "./pages/history.js";
import { MaskPage } from "./pages/mask.js";
import { PersistPage } from "./pages/persist.js";
import { RendersPage } from "./pages/renders.js";
import { RulesPage } from "./pages/rules.js";
import { SavePage } from "./pages/save.js";

const pages: Pages<ComponentType> = {
  basic: BasicPage,
  arrays: ArraysPage,
  rules: RulesPage,
  save: SavePage,
  dirty: DirtyPage,
  async: AsyncPage,
  renders: RendersPage,
  history: HistoryPage,
  mask: MaskPage,
  persist: PersistPage,
  bind: BindPage,
};

interface AppProps {
  readonly path: string;
}

/** The page for `path`: a scenario, or the index of them all. */
export function App({ path }: AppProps) {
  const scenario = scenarioAt(path);
  if (scenario === undefined) {
    return (
      <main>
        <h1>{indexTitle}</h1>
        <ul>
          {scenarios.map((entry) => (
            <li key={entry.id}>
              <a href={entry.route}>{entry.title}</a>
            </li>
          ))}
        </ul>
      </main>
    );
  }
  const Page = pages[scenario.id];
  return (
    <main>
      <h1>{scenario.title}</h1>
      <Page />
    </main>
  );
}
