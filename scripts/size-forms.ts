// Measures real forms, not entry points. Each fixture in fixtures/react and
// fixtures/solid is a small app. Vite builds it from source, minified, once in
// production and once in development, and the table gives each bundle's
// brotli size. React, Solid and Valibot stay external, so the numbers are the
// forms code plus the fixture's own few lines. Run from the repo root:
//
//   bun run size:forms
//
// In GitHub Actions the table also goes to the job summary.
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync } from "node:zlib";
import solid from "@solidjs/vite-plugin";
import { build, defaultClientConditions, type PluginOption, type Rolldown } from "vite";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

// Workspace packages export their source under this condition.
const sourceCondition = "@lunarhue/source";

const external = /^(react|react-dom|solid-js|@solidjs\/web|valibot)(\/|$)/;

const forms = [
  ["bare", "Bare form, one field bound by hand"],
  ["validator", "+ a field validator"],
  ["schema", "+ a Valibot schema"],
  ["plugins", "+ mask and rules"],
  ["registered", "Registered field component"],
  ["arrays", "+ an array: items, add, remove, move"],
  ["everything", "Everything on"],
  ["devtools", "Bare form + devtools()"],
] as const;

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
    plugins,
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

const bytes = (size: number): string => `${size.toLocaleString("en-US")} B`;

const header = ["Form", ...frameworks.flatMap(([, name]) => modes.map((mode) => `${name} ${mode === "production" ? "prod" : "dev"}`))];
const rows: string[][] = [];
for (const [form, label] of forms) {
  const row: string[] = [label];
  for (const [framework, , plugins] of frameworks) {
    for (const mode of modes) row.push(bytes(await measure(framework, plugins(), form, mode)));
  }
  rows.push(row);
}

const line = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;
const table = [
  line(header),
  line(header.map((_, index) => (index === 0 ? "---" : "---:"))),
  ...rows.map(line),
].join("\n");

console.log("Minified, brotli. React, Solid and Valibot are external.\n");
console.log(table);

const summary = process.env["GITHUB_STEP_SUMMARY"];
if (summary) appendFileSync(summary, `### Form sizes\n\nMinified, brotli. React, Solid and Valibot are external.\n\n${table}\n`);
