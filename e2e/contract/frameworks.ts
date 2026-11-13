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
}

/** Every framework with an app. Adding one is a new app in `apps/` and one line here. */
export const frameworks: readonly Framework[] = [
  {
    name: "react",
    port: 4311,
    rerendersOnChange: true,
    knownFailures: {
      "inputs.spec.ts > markup > a valid text input and checkbox carry the contract's attributes in the server HTML":
        "React writes aria-invalid=false on every valid input and aria-readonly=false on checkboxes, and leaves out type=text. Solid does what the contract says.",
      "inputs.spec.ts > markup > a valid text input and checkbox carry the contract's attributes after hydration":
        "Same as the server HTML: aria-invalid=false, aria-readonly=false, no type=text.",
      "inputs.spec.ts > number inputs > text that isn't a number yet, such as a lone minus sign, leaves the stored value":
        "React stores undefined while the input holds text such as '-' that isn't a number yet. Solid checks validity.badInput and keeps the stored value.",
    },
  },
  {
    name: "solid",
    port: 4312,
    rerendersOnChange: false,
  },
];

/** The framework of a Playwright project. */
export function frameworkNamed(name: string): Framework {
  const framework = frameworks.find((entry) => entry.name === name);
  if (framework === undefined) throw new Error(`No framework is named "${name}".`);
  return framework;
}
