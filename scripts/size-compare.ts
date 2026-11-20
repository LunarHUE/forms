// Measures the comparison apps in examples/compare: each app built once with
// @lunarhue/forms and once with TanStack Form. Vite builds every app three
// times for production, minified:
//
// - total: everything the page loads, React and Zod included.
// - forms: the form library and the app's own code. React, react-dom and Zod
//   are external.
// - app: the app's own code only. The form libraries are external too.
//
// Our packages resolve to their built dist, as an app installing them would
// get, so build first. Run from the repo root:
//
//   bun run build && bun run size:compare           # writes examples/compare/sizes.json
//   bun run build && bun run size:compare --check   # fails when the file is stale
//
// Only JavaScript counts. The CSS is the same file on both sides. In GitHub
// Actions the table also goes to the job summary.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { build, type Rolldown } from "vite";
import { apps, libraries } from "../examples/compare/apps.js";

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const compare = join(repo, "examples", "compare");
const sizesFile = join(compare, "sizes.json");
const check = process.argv.includes("--check");

// The version our side is published as. The build is the workspace's.
const ourVersion = "0.2.0";

const builds = [
  { name: "total", title: "Total", external: [] },
  { name: "forms", title: "Forms + app", external: ["react", "react-dom", "scheduler", "zod"] },
  { name: "app", title: "App only", external: ["react", "react-dom", "scheduler", "zod", "@lunarhue", "@tanstack"] },
] as const;

type BuildName = (typeof builds)[number]["name"];

interface Size {
  readonly min: number;
  readonly gzip: number;
  readonly brotli: number;
}

interface Sizes {
  readonly versions: Readonly<Record<string, string>>;
  readonly builds: Readonly<Record<BuildName, string>>;
  readonly apps: Readonly<Record<string, Readonly<Record<string, Readonly<Record<BuildName, Size>>>>>>;
}

/** Matches a module or any of its subpaths, or every package in a scope. */
function externalTest(names: readonly string[]): (id: string) => boolean {
  return (id) => names.some((name) => id === name || id.startsWith(`${name}/`));
}

async function measure(entry: string, external: readonly string[]): Promise<Size> {
  const output = await build({
    configFile: false,
    logLevel: "silent",
    mode: "production",
    root: compare,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      write: false,
      minify: true,
      modulePreload: false,
      rolldownOptions: { input: entry, external: externalTest(external) },
    },
  });
  if (!Array.isArray(output) && !("output" in output)) throw new Error("Expected a build, got a watcher.");
  const chunks = (Array.isArray(output) ? output : [output])
    .flatMap((result: Rolldown.RolldownOutput) => result.output)
    .filter((file) => file.type === "chunk");
  let min = 0;
  let gzip = 0;
  let brotli = 0;
  for (const chunk of chunks) {
    const code = Buffer.from(chunk.code);
    min += code.length;
    gzip += gzipSync(code, { level: 9 }).length;
    brotli += brotliCompressSync(code, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
  }
  return { min, gzip, brotli };
}

function versionOf(name: string): string {
  const require = createRequire(join(compare, "package.json"));
  const manifest: unknown = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8"));
  if (typeof manifest !== "object" || manifest === null || !("version" in manifest) || typeof manifest.version !== "string") {
    throw new Error(`${name} has no version.`);
  }
  return manifest.version;
}

for (const name of ["core", "react", "schema"]) {
  if (!existsSync(join(repo, "packages", name, "dist"))) {
    throw new Error(`packages/${name}/dist is missing. Run \`bun run build\` first.`);
  }
}

const measured: Record<string, Record<string, Record<BuildName, Size>>> = {};
for (const app of apps) {
  const perLibrary: Record<string, Record<BuildName, Size>> = {};
  for (const library of libraries) {
    const entry = join(compare, app.name, library.name, "main.tsx");
    perLibrary[library.name] = {
      total: await measure(entry, builds[0].external),
      forms: await measure(entry, builds[1].external),
      app: await measure(entry, builds[2].external),
    };
  }
  measured[app.name] = perLibrary;
}

const fresh: Sizes = {
  versions: {
    "@lunarhue/forms-react": ourVersion,
    "@tanstack/react-form": versionOf("@tanstack/react-form"),
    react: versionOf("react"),
    "react-dom": versionOf("react-dom"),
    zod: versionOf("zod"),
    vite: versionOf("vite"),
  },
  builds: {
    total: "Everything the page loads: React, react-dom, Zod, the form library and the app.",
    forms: "The form library and the app's own code. React, react-dom and Zod are external.",
    app: "The app's own code only. React, react-dom, Zod, @lunarhue/* and @tanstack/* are external.",
  },
  apps: measured,
};

const kb = (bytes: number): string => `${(bytes / 1000).toFixed(2)} kB`;
const cell = (size: Size): string => `${kb(size.min)} / ${kb(size.gzip)} / ${kb(size.brotli)}`;
const line = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;
const header = ["App", "Library", ...builds.map((b) => b.title), "Library alone (brotli)"];
const table = [
  line(header),
  line(header.map((_, index) => (index < 2 ? "---" : "---:"))),
  ...apps.flatMap((app) =>
    libraries.map((library) => {
      const sizes = fresh.apps[app.name]?.[library.name];
      if (sizes === undefined) throw new Error(`No sizes for ${app.name} ${library.name}.`);
      return line([
        app.title,
        library.title,
        ...builds.map((b) => cell(sizes[b.name])),
        kb(sizes.forms.brotli - sizes.app.brotli),
      ]);
    }),
  ),
].join("\n");

const note = [
  `Minified / gzip / brotli, JavaScript only. @lunarhue/forms ${ourVersion} (workspace build),`,
  `@tanstack/react-form ${fresh.versions["@tanstack/react-form"]}, React ${fresh.versions["react"]}, Zod ${fresh.versions["zod"]}.`,
  `"Library alone" is Forms + app minus App only.`,
].join(" ");

console.log(`${note}\n`);
console.log(table);

const summary = process.env["GITHUB_STEP_SUMMARY"];
if (summary) appendFileSync(summary, `### Comparison app sizes\n\n${note}\n\n${table}\n`);

const json = `${JSON.stringify(fresh, null, 2)}\n`;
if (check) {
  const committed = existsSync(sizesFile) ? readFileSync(sizesFile, "utf8") : "";
  if (committed !== json) {
    console.error("\nexamples/compare/sizes.json is out of date. Run `bun run build && bun run size:compare` and commit it.");
    process.exit(1);
  }
  console.log("\nexamples/compare/sizes.json is up to date.");
} else {
  writeFileSync(sizesFile, json);
  console.log("\nWrote examples/compare/sizes.json.");
}
