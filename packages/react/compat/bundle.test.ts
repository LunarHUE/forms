// @vitest-environment node
import { createElement, version } from "react";
import { renderToString } from "react-dom/server";
import { build, defaultClientConditions } from "vite";
import { expect, it } from "vitest";

// Runs in the React 17 project only. Bundlers see nothing missing when a
// module imports a name React 17 lacks, since React 17 is CommonJS. Node's
// own ESM loader does check, and fails to link such a module. So this
// bundles an app that imports the adapter by its package name, with React
// left external, then has Node import the bundle natively, with React 17
// next to it. Importing by name also applies the package's `sideEffects`
// list, which the legacy entry needs to keep its fallbacks. The project
// config externalizes `compat/react-17/dist`, so Vitest doesn't transform it.

const root = new URL("..", import.meta.url).pathname;

/** A log entry from the bundler. */
interface Log {
  readonly code?: string;
  readonly message: string;
}

/** The parts of the adapter the server render below uses. */
interface Bundle {
  createForms(): { define(config: { defaultValues: { name: string } }): object };
  useForm(definition: object, options?: { id: string }): { root: { at(name: "name"): unknown } };
  useField(handle: unknown): { readonly value: string };
}

/** Bundles an app that re-exports the adapter from `specifier`, checks the bundler logged nothing, and imports it. */
async function bundle(specifier: string, name: string): Promise<Bundle> {
  const app = `${root}compat/${name}.js`;
  const outDir = `${root}compat/react-17/dist/${name}`;
  const logs: Log[] = [];
  await build({
    configFile: false,
    logLevel: "silent",
    root,
    resolve: { conditions: ["@lunarhue/source", ...defaultClientConditions] },
    plugins: [
      {
        name: "lunarhue:app",
        resolveId: (id) => (id === app ? id : null),
        load: (id) => (id === app ? `export { createForms, useField, useForm } from "${specifier}";` : null),
      },
    ],
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      lib: { entry: app, formats: ["es"], fileName: () => "app.mjs" },
      rolldownOptions: {
        external: [/^react(\/|$)/],
        onLog(_level: string, log: Log) {
          logs.push(log);
        },
      },
    },
  });
  expect(logs).toEqual([]);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return (await import(/* @vite-ignore */ `${outDir}/app.mjs`)) as Bundle;
}

/** Server renders a form's `name` field through `adapter`. */
function renderName(adapter: Bundle, options?: { id: string }): string {
  const profile = adapter.createForms().define({ defaultValues: { name: "Ada" } });
  function Name() {
    const form = adapter.useForm(profile, options);
    return createElement("p", null, adapter.useField(form.root.at("name")).value);
  }
  return renderToString(createElement(Name));
}

it("bundles the legacy entry for React 17 with no warning and loads it in Node's ESM loader", async () => {
  expect(version.startsWith("17.")).toBe(true);
  const adapter = await bundle("@lunarhue/forms-react/legacy", "legacy");
  expect(renderName(adapter, { id: "profile" })).toMatch(/>Ada<\/p>$/);
});

it("loads the main entry on React 17 and throws a clear error at first use", async () => {
  const adapter = await bundle("@lunarhue/forms-react", "main");
  expect(() => renderName(adapter)).toThrow("@lunarhue/forms-react: React before 18 needs @lunarhue/forms-react/legacy.");
});
