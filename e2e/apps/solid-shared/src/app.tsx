import { indexTitle, type Pages, scenarioAt, scenarios } from "@lunarhue/forms-e2e/contract";
import { Dynamic } from "@solidjs/web";
import { type Component, For, Show } from "solid-js";
import { ArraysPage } from "./pages/arrays.js";
import { AsyncPage } from "./pages/async.js";
import { BasicPage } from "./pages/basic.js";
import { BindPage } from "./pages/bind.js";
import { DirtyPage } from "./pages/dirty.js";
import { HistoryPage } from "./pages/history.js";
import { InspectPage } from "./pages/inspect.js";
import { MaskPage } from "./pages/mask.js";
import { PersistPage } from "./pages/persist.js";
import { RendersPage } from "./pages/renders.js";
import { RulesPage } from "./pages/rules.js";
import { SavePage } from "./pages/save.js";

const pages: Pages<Component> = {
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
  inspect: InspectPage,
};

interface AppProps {
  readonly path: string;
}

/** The page for `path`: a scenario, or the index of them all. */
export function App(props: AppProps) {
  return (
    <Show
      when={scenarioAt(props.path)}
      fallback={
        <main>
          <h1>{indexTitle}</h1>
          <ul>
            <For each={scenarios}>
              {(entry) => (
                <li>
                  <a href={entry.route}>{entry.title}</a>
                </li>
              )}
            </For>
          </ul>
        </main>
      }
    >
      {(scenario) => (
        <main>
          <h1>{scenario().title}</h1>
          <Dynamic component={pages[scenario().id]} />
        </main>
      )}
    </Show>
  );
}
