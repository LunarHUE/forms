import { defineConfig } from "oxlint";

// React Compiler rules, as named in eslint-plugin-react-hooks 7 `recommended-latest`.
// oxlint ports most of them natively under `react/`; the upstream plugin also runs
// through jsPlugins so the React code here follows the compiler's own implementation.
const compilerRules = [
  "rules-of-hooks",
  "exhaustive-deps",
  "static-components",
  "use-memo",
  "void-use-memo",
  "preserve-manual-memoization",
  "incompatible-library",
  "immutability",
  "globals",
  "refs",
  "set-state-in-effect",
  "error-boundaries",
  "purity",
  "set-state-in-render",
  "unsupported-syntax",
] as const;

const basePlugins = ["eslint", "typescript", "unicorn", "oxc", "import", "vitest"] as const;

export default defineConfig({
  // Setting `plugins` replaces the default set, so the defaults are listed too.
  plugins: [...basePlugins],
  categories: {
    correctness: "error",
    suspicious: "warn",
  },
  options: {
    typeAware: true,
    denyWarnings: true,
  },
  settings: {
    // Lowest React the adapter supports. Only used where the react plugin is on.
    react: { version: "16.8.0" },
  },
  rules: {
    // These check that imported names exist in the target module. oxlint's
    // resolver can't use the @lunarhue/source condition, so before a build it
    // can't see through `export * from "@lunarhue/forms-core"` and reports
    // false positives. tsc already checks the same thing with the condition.
    "import/namespace": "off",
    "import/default": "off",
    "import/no-named-as-default-member": "off",
    // Stylesheets are imported for their side effect (the docs' global.css).
    "import/no-unassigned-import": ["warn", { allow: ["**/*.css"] }],
  },
  overrides: [
    {
      // The adapter, the e2e React apps, the React fixtures in scripts, the
      // parked inspector's React wrapper and the docs site's React code, the
      // README's example included, follow the same rules. The docs' Solid demos live in src/demos/solid and stay out.
      files: [
        "packages/react/**",
        "e2e/apps/react*/**",
        "scripts/fixtures/react/**",
        "parked/inspector/src/react.tsx",
        "apps/docs/src/components/**",
        "apps/docs/src/devtools/**",
        "apps/docs/src/demos/react/**",
        "apps/docs/src/layouts/**",
        "apps/docs/src/readme/**",
      ],
      // An override's `plugins` replaces the base list.
      plugins: [...basePlugins, "react"],
      // `react` is a reserved plugin name, so the upstream plugin gets an alias.
      jsPlugins: [{ name: "react-hooks-js", specifier: "eslint-plugin-react-hooks" }],
      rules: {
        ...Object.fromEntries(compilerRules.map((rule) => [`react/${rule}`, "error"])),
        ...Object.fromEntries(
          [...compilerRules, "config", "gating"].map((rule) => [`react-hooks-js/${rule}`, "error"]),
        ),
      },
    },
  ],
  // shadcn generates apps/docs/src/components/ui; it isn't edited by hand.
  ignorePatterns: ["**/dist/**", "**/coverage/**", "**/.astro/**", "apps/docs/src/components/ui/**"],
});
