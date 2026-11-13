import { test as base, expect, type Locator, type Page } from "@playwright/test";
import {
  type Framework,
  frameworks,
  type ProbeState,
  type ScenarioId,
  scenarios,
  testIds,
} from "../contract/index.js";

/** What each project passes to its specs. */
export interface Options {
  /** The framework this project runs against. Specs read only its expectations. */
  readonly framework: Framework;
}

interface Fixtures {
  /** Marks the running spec as an expected failure when the framework lists it. */
  readonly knownFailure: undefined;
}

// Every project sets `framework`. An option needs a default, so it is the first one.
const [firstFramework] = frameworks;
if (firstFramework === undefined) throw new Error("contract/frameworks.ts lists no framework.");

export const test = base.extend<Fixtures & Options>({
  framework: [firstFramework, { option: true }],
  knownFailure: [
    async ({ framework }, use, testInfo) => {
      const key = testInfo.titlePath.join(" > ");
      const note = framework.knownFailures?.[key];
      testInfo.fail(note !== undefined, note);
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect };

/** Opens a scenario's page and waits until it has hydrated, which is when the probe fills. */
export async function open(page: Page, id: ScenarioId): Promise<void> {
  const scenario = scenarios.find((entry) => entry.id === id);
  if (scenario === undefined) throw new Error(`No scenario "${id}".`);
  await page.goto(scenario.route);
  await expect(page.getByTestId(testIds.probe)).not.toBeEmpty();
}

/** The form's state as the probe shows it now. */
export async function probe(page: Page): Promise<ProbeState> {
  const text = await page.getByTestId(testIds.probe).textContent();
  // The probe writes JSON of exactly this shape.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return JSON.parse(text ?? "null") as ProbeState;
}

/** An input by its label. */
export const input = (page: Page, label: string): Locator => page.getByLabel(label, { exact: true });

/** The element that holds an input's errors, found through its `aria-describedby`. */
export async function describedBy(page: Page, field: Locator): Promise<Locator> {
  const id = await field.getAttribute("aria-describedby");
  expect(id, "the input points at its errors").not.toBeNull();
  return page.locator(`[id="${id}"]`);
}

/** The count a render counter shows. */
export async function renders(page: Page, id: string): Promise<number> {
  return Number(await page.getByTestId(testIds.renders(id)).textContent());
}

/** Collects console errors, warnings and page errors from now on. */
export function consoleProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}
