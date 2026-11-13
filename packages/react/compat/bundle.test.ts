// @vitest-environment node
import { createElement, version } from "react";
import { renderToString } from "react-dom/server";
import { build, defaultClientConditions } from "vite";
import { expect, it } from "vitest";

// Runs in the React 17 project only. Bundlers see nothing missing when a
// module imports a name React 17 lacks, since React 17 is CommonJS. Node's
// own ESM loader does check, and fails to link such a module. So this
// bundles the adapter as ESM with React left external, then has Node import
// the bundle natively, with React 17 next to it. The project config
// externalizes `compat/react-17/dist`, so Vitest doesn't transform it.

const root = new URL("..", import.meta.url).pathname;
const outDir = `${root}compat/react-17/dist`;

/** A log entry from the bundler. */
interface Log {
  readonly code?: string;
  readonly message: string;
}

/** The parts of the adapter the server render below uses. */
interface Bundle {
  createForms(): { define(config: { defaultValues: { name: string } }): BundleForm };
  useField(handle: unknown): { readonly value: string };
}

interface BundleForm {
  useForm(options: { id: string }): { root: { at(name: "name"): unknown } };
}

it("bundles for React 17 with no warning and loads in Node's ESM loader", async () => {
  expect(version.startsWith("17.")).toBe(true);
  const logs: Log[] = [];
  await build({
    configFile: false,
    logLevel: "silent",
    root,
    resolve: { conditions: ["@lunarhue/source", ...defaultClientConditions] },
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      lib: { entry: `${root}src/index.ts`, formats: ["es"], fileName: () => "adapter.mjs" },
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
  const bundle = (await import(/* @vite-ignore */ `${outDir}/adapter.mjs`)) as Bundle;
  const profile = bundle.createForms().define({ defaultValues: { name: "Ada" } });
  function Name() {
    const form = profile.useForm({ id: "profile" });
    return createElement("p", null, bundle.useField(form.root.at("name")).value);
  }
  expect(renderToString(createElement(Name))).toMatch(/>Ada<\/p>$/);
});
