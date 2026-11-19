/**
 * Something a spec needs that not every framework major has. A spec that
 * needs one calls `requires` from specs/fixtures.ts, and on a major that
 * lacks it the spec is skipped with the major's reason.
 *
 * - `generatedIds`: a form with no `id` gets one that matches between the
 *   server and the client, such as React's `useId`.
 */
export type Capability = "generatedIds";

/** One major of a framework the suite runs against. Its app lives in `apps/<name>`. */
export interface Framework {
  /** The Playwright project's name and the app's directory under `apps/`, such as `react18`. */
  readonly name: string;
  /**
   * True for the newest major of its framework. Pull requests and pushes to
   * main run only these in Firefox and WebKit, and every major in Chromium.
   */
  readonly newest: boolean;
  /** The port its server listens on. Keep these well away from 3000. */
  readonly port: number;
  /**
   * True when a component that reads changed state runs again, as in React.
   * False when components run once and the DOM updates in place, as in
   * Solid, so every render counter stays at 1.
   */
  readonly rerendersOnChange: boolean;
  /** The capabilities it lacks, each with the reason, which the skipped spec reports. */
  readonly lacks?: Readonly<Partial<Record<Capability, string>>>;
  /**
   * Specs expected to fail on this framework, as `<spec file> > <test title>`,
   * each with a note on what differs. A spec listed here runs as `test.fail`,
   * so it turns red once the adapter is fixed and the entry should go.
   */
  readonly knownFailures?: Readonly<Record<string, string>>;
  /**
   * Specs expected to fail on this framework in one browser only, keyed by
   * the browser and then as `knownFailures` is. They run as `test.fail` in
   * that browser and as ordinary specs in the others.
   */
  readonly knownFailuresIn?: Readonly<Partial<Record<Browser, Readonly<Record<string, string>>>>>;
}

/** The browsers the suite runs in, by Playwright's names. */
export type Browser = "chromium" | "firefox" | "webkit";

const noUseId = "React before 18 has no useId, so its pages pass an id to useForm.";

/** Every framework major with an app. Adding one is a new app in `apps/` and one entry here. */
export const frameworks: readonly Framework[] = [
  { name: "react16", port: 4316, newest: false, rerendersOnChange: true, lacks: { generatedIds: noUseId } },
  { name: "react17", port: 4317, newest: false, rerendersOnChange: true, lacks: { generatedIds: noUseId } },
  { name: "react18", port: 4318, newest: false, rerendersOnChange: true },
  { name: "react19", port: 4319, newest: true, rerendersOnChange: true },
  { name: "solid1", port: 4331, newest: false, rerendersOnChange: false },
  { name: "solid2", port: 4332, newest: true, rerendersOnChange: false },
];

/** The framework of a Playwright project. */
export function frameworkNamed(name: string): Framework {
  const framework = frameworks.find((entry) => entry.name === name);
  if (framework === undefined) throw new Error(`No framework is named "${name}".`);
  return framework;
}
