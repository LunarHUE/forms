/** One framework the suite runs against. Its app lives in `apps/<name>`. */
export interface Framework {
  /** The Playwright project's name and the app's directory under `apps/`. */
  readonly name: string;
  /** The port its server listens on. Keep these well away from 3000. */
  readonly port: number;
  /**
   * True when a component that reads changed state runs again, as in React.
   * False when components run once and the DOM updates in place, as in
   * Solid, so every render counter stays at 1.
   */
  readonly rerendersOnChange: boolean;
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

/** Every framework with an app. Adding one is a new app in `apps/` and one line here. */
export const frameworks: readonly Framework[] = [
  {
    name: "react",
    port: 4311,
    rerendersOnChange: true,
  },
  {
    name: "solid",
    port: 4312,
    rerendersOnChange: false,
    knownFailuresIn: {
      webkit: {
        "arrays.spec.ts > moving a row keeps its input, its focus and its key":
          "The moved row's input loses focus in WebKit. https://github.com/LunarHUE/forms/issues/157",
      },
    },
  },
];

/** The framework of a Playwright project. */
export function frameworkNamed(name: string): Framework {
  const framework = frameworks.find((entry) => entry.name === name);
  if (framework === undefined) throw new Error(`No framework is named "${name}".`);
  return framework;
}
