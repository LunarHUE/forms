// Measures real forms, not entry points. Each fixture in fixtures/react and
// fixtures/solid is a small app. Vite builds it from source, minified, once in
// production and once in development, and the table gives each bundle's
// brotli size. React, Solid and Valibot stay external, so the numbers are the
// forms code plus the fixture's own few lines. Run from the repo root:
//
//   bun run size:forms
//   bun run size:forms --json   # the same sizes as JSON, for scripts/size-report.ts
//
// In GitHub Actions the table also goes to the job summary, unless --json is
// passed.
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync } from "node:zlib";
import solid from "@solidjs/vite-plugin";
import { build, defaultClientConditions, type PluginOption, type Rolldown } from "vite";
import { panelCss } from "../packages/devtools/panel-css.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

// Workspace packages export their source under this condition.
const sourceCondition = "@lunarhue/source";

const external = /^(react|react-dom|solid-js|@solidjs\/web|valibot)(\/|$)/;

// The third member names the only framework a fixture exists for. /mini is React only.
const forms: readonly (readonly [form: string, label: string, only?: string])[] = [
  ["bare", "Bare form, one field bound by hand"],
  ["validator", "+ a field validator"],
  ["schema", "+ a Valibot schema"],
  ["plugins", "+ mask and rules"],
  ["registered", "Registered field component"],
  ["registered-mini", "Registered field component on /mini", "react"],
  ["arrays", "+ an array: items, add, remove, move"],
  ["everything", "Everything on"],
  ["devtools", "Bare form + devtools()"],
  ["search", "Search box: one required field", "react"],
  ["search-mini", "Search box on /mini", "react"],
  ["search-mini-per-field", "Search box on /mini + perField()", "react"],
  ["login", "Login: two fields, a Valibot schema", "react"],
  ["login-mini", "Login on /mini", "react"],
  ["login-mini-per-field", "Login on /mini + perField()", "react"],
];

const frameworks = [
  ["react", "React", (): PluginOption[] => []],
  ["solid", "Solid", (): PluginOption[] => [solid()]],
] as const;

const modes = ["production", "development"] as const;

type Mode = (typeof modes)[number];

/** Builds one fixture and returns the brotli size of its JavaScript. */
async function measure(framework: string, plugins: PluginOption[], form: string, mode: Mode): Promise<number> {
  const output = await build({
    configFile: false,
    logLevel: "silent",
    mode,
    root: join(fixtures, framework),
    // The devtools fixture pulls in the panel, whose stylesheet is a virtual module.
    plugins: [panelCss(), ...plugins],
    resolve: { conditions: [sourceCondition, ...defaultClientConditions] },
    define: { "process.env.NODE_ENV": JSON.stringify(mode) },
    build: {
      write: false,
      minify: true,
      modulePreload: false,
      rolldownOptions: {
        input: join(fixtures, framework, `${form}.tsx`),
        external: (id) => external.test(id),
        // Keep `App` so the app isn't shaken away.
        preserveEntrySignatures: "exports-only",
      },
    },
  });
  if (!Array.isArray(output) && !("output" in output)) throw new Error("Expected a build, got a watcher.");
  const chunks = (Array.isArray(output) ? output : [output])
    .flatMap((result: Rolldown.RolldownOutput) => result.output)
    .filter((file) => file.type === "chunk");
  return chunks.reduce((total, chunk) => total + brotliCompressSync(chunk.code).length, 0);
}

const json = process.argv.includes("--json");

const bytes = (size: number): string => `${size.toLocaleString("en-US")} B`;
const line = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;

const column = (framework: string, mode: Mode): string => `${framework} ${mode === "production" ? "prod" : "dev"}`;
const columns = frameworks.flatMap(([, name]) => modes.map((mode) => column(name, mode)));

const rows: { name: string; sizes: Record<string, number> }[] = [];
for (const [form, label, only] of forms) {
  const sizes: Record<string, number> = {};
  for (const [framework, name, plugins] of frameworks) {
    if (only && only !== framework) continue;
    for (const mode of modes) sizes[column(name, mode)] = await measure(framework, plugins(), form, mode);
  }
  rows.push({ name: label, sizes });
}

if (json) {
  console.log(JSON.stringify({ columns, rows }, null, 2));
} else {
  const header = ["Form", ...columns];
  const table = [
    line(header),
    line(header.map((_, index) => (index === 0 ? "---" : "---:"))),
    ...rows.map((row) =>
      line([row.name, ...columns.map((name) => (row.sizes[name] === undefined ? "n/a" : bytes(row.sizes[name])))]),
    ),
  ].join("\n");

  console.log("Minified, brotli. React, Solid and Valibot are external.\n");
  console.log(table);

  const summary = process.env["GITHUB_STEP_SUMMARY"];
  if (summary) appendFileSync(summary, `### Form sizes\n\nMinified, brotli. React, Solid and Valibot are external.\n\n${table}\n`);
}
