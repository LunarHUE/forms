// Measures a production build for the Bundle tab. The Vite plugin calls this
// in its own build, and in dev runs it on a worker thread (`measureInWorker`).
// The worker loads this file directly, so it imports nothing at runtime but
// Node and Vite, and its type imports are erased.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { gzipSync } from "node:zlib";
import type { InlineConfig, Plugin, Rolldown } from "vite";
import type { SizePart, SizeReport } from "../sizes.js";

/** The report's file name in a build's output, at the root of `outDir`. */
export const reportFile = "lunarhue-forms-sizes.json";

const devtoolsPackage = "@lunarhue/forms-devtools";
const adapters: Readonly<Record<string, string>> = {
  "@lunarhue/forms-react": "react",
  "@lunarhue/forms-solid": "solid",
  "@lunarhue/forms-vue": "vue",
};

interface Owner {
  readonly kind: SizePart["kind"];
  readonly name: string;
}

interface PackageInfo {
  readonly dir: string;
  readonly name: string;
  /** Packages it installs alongside it: `dependencies` and `peerDependencies`. */
  readonly installs: ReadonlySet<string>;
}

const packages = new Map<string, PackageInfo | undefined>();

/** The nearest package.json above `file` that has a name. */
function packageOf(file: string): PackageInfo | undefined {
  const dir = dirname(file);
  if (packages.has(dir)) return packages.get(dir);
  let found: PackageInfo | undefined;
  try {
    const json: unknown = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"));
    const name: unknown = json !== null && typeof json === "object" ? Reflect.get(json, "name") : undefined;
    if (typeof name === "string" && json !== null && typeof json === "object") {
      const keys = (field: string): string[] => {
        const value: unknown = Reflect.get(json, field);
        return value !== null && typeof value === "object" ? Object.keys(value) : [];
      };
      found = { dir, name, installs: new Set([...keys("dependencies"), ...keys("peerDependencies")]) };
    }
  } catch {
    // No package.json here: keep looking up.
  }
  if (found === undefined && dirname(dir) !== dir) found = packageOf(dir);
  packages.set(dir, found);
  return found;
}

/** The forms library's packages, or an import from one of them. */
export const formsPackage = /^@lunarhue\/forms-(?:core|react|solid|vue|schema|bind|devtools)(?:\/|$)/;

const isForms = (name: string | undefined): boolean => name !== undefined && formsPackage.test(name);

/** The name a plugin file gives its plugin, as in `name: "history"`. */
function pluginName(file: string): string | undefined {
  try {
    return /\bname:\s*"([\w$-]+)"/.exec(readFileSync(file, "utf8"))?.[1];
  } catch {
    return undefined;
  }
}

const corePlugin = /[/\\]plugins[/\\](?!index\.|testing\.)[^/\\]+\.[cm]?[jt]sx?$/;

/**
 * Who a file belongs to on its own path. `owner` settles it. Otherwise the
 * file takes the plugin its importers share, and `fallback` when they share
 * none.
 */
function byPath(file: string): { readonly owner?: Owner; readonly fallback?: Owner; readonly forms: boolean } {
  const name = packageOf(file)?.name;
  if (name === devtoolsPackage) return { owner: { kind: "devtools", name: "devtools" }, forms: true };
  const adapter = name === undefined ? undefined : adapters[name];
  if (adapter !== undefined) return { owner: { kind: "adapter", name: adapter }, forms: true };
  if (name === "@lunarhue/forms-core") {
    const plugin = corePlugin.test(file) ? pluginName(file) : undefined;
    return plugin === undefined ? { fallback: { kind: "core", name }, forms: true } : { owner: { kind: "plugin", name: plugin }, forms: true };
  }
  if (name === "@lunarhue/forms-schema") {
    const plugin = pluginName(file);
    return plugin === undefined ? { forms: true } : { owner: { kind: "plugin", name: plugin }, forms: true };
  }
  return { forms: isForms(name) };
}

const vlq: Record<string, number> = Object.fromEntries("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("").map((char, index) => [char, index]));

/** Each line's segments of a source map: `[column, source]`, with `source` -1 for an unmapped segment. */
function decode(mappings: string): [number, number][][] {
  const lines: [number, number][][] = [];
  let source = 0;
  for (const line of mappings.split(";")) {
    const segments: [number, number][] = [];
    let column = 0;
    for (const segment of line.split(",")) {
      if (segment === "") continue;
      const fields: number[] = [];
      let value = 0;
      let shift = 0;
      for (const char of segment) {
        const digit = vlq[char] ?? 0;
        value += (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
        } else {
          fields.push(value & 1 ? -(value >>> 1) : value >>> 1);
          value = 0;
          shift = 0;
        }
      }
      column += fields[0] ?? 0;
      if (fields.length >= 4) {
        source += fields[1] ?? 0;
        segments.push([column, source]);
      } else {
        segments.push([column, -1]);
      }
    }
    lines.push(segments);
  }
  return lines;
}

/** What `sizeReport` needs of a module from the build's module graph. */
export interface ModuleLinks {
  readonly importers: readonly string[];
  readonly dynamicImporters: readonly string[];
}

/** A module id as a file path: without Rollup's `\0` prefix or a query. */
const fileOf = (id: string): string => id.replace(/^\0/, "").replace(/\?.*$/, "");

/**
 * Measures a build's JavaScript chunks. Each minified byte goes to the file
 * its source map points it at, and each file to a part: core, an adapter, a
 * plugin or the devtools, by its package and, in core, its plugin file. A
 * file of core that only one plugin imports, such as the mask's caret
 * helpers, goes to that plugin, and a dependency only one part imports, such
 * as the panel's Preact, goes to that part. The rest counts in the total only.
 */
export function sizeReport(
  chunks: readonly Rolldown.OutputChunk[],
  outDir: string,
  links: (id: string) => ModuleLinks | null,
  bundler = "vite",
): SizeReport {
  const bytes = new Map<string, number>();
  const chunksOf = new Map<string, Set<string>>();
  let minified = 0;
  let gzip = 0;
  for (const chunk of chunks) {
    const code = chunk.code;
    minified += Buffer.byteLength(code);
    gzip += gzipSync(code).length;
    const map = chunk.map;
    if (!map) continue;
    const from = resolve(outDir, dirname(chunk.fileName));
    const sources = map.sources.map((source) => (source ? resolve(from, source) : ""));
    const count = (source: number, text: string) => {
      const file = sources[source];
      if (!file || text === "") return;
      bytes.set(file, (bytes.get(file) ?? 0) + Buffer.byteLength(text));
      let names = chunksOf.get(file);
      if (!names) chunksOf.set(file, (names = new Set()));
      names.add(chunk.fileName);
    };
    const segmentsOf = decode(map.mappings);
    // A segment runs to the next one, across line ends: a template literal
    // that keeps its newlines has no segments on its inner lines.
    let current = -1;
    code.split("\n").forEach((text, index) => {
      const segments = segmentsOf[index] ?? [];
      count(current, `${text.slice(0, segments[0]?.[0] ?? text.length)}${index > 0 ? "\n" : ""}`);
      segments.forEach(([column, source], at) => {
        count(source, text.slice(column, segments[at + 1]?.[0] ?? text.length));
        current = source;
      });
    });
  }

  const importersOf = new Map<string, string[]>();
  for (const chunk of chunks) {
    for (const id of Object.keys(chunk.modules)) {
      const file = fileOf(id);
      if (importersOf.has(file)) continue;
      const info = links(id);
      importersOf.set(file, info ? [...info.importers, ...info.dynamicImporters].map(fileOf) : []);
    }
  }

  const owners = new Map<string, Owner | undefined>();
  /** The one part every importer that made it into the build belongs to. */
  const shared = (file: string, visiting: Set<string>): Owner | undefined => {
    let common: Owner | undefined;
    for (const importer of importersOf.get(file) ?? []) {
      // An importer with no bytes in the build doesn't count: a plugin cut
      // from the build still imports its helpers, and a re-exporting index
      // imports everything.
      if (!bytes.get(importer)) continue;
      const owner = ownerOf(importer, visiting);
      if (owner === undefined || (common !== undefined && (common.kind !== owner.kind || common.name !== owner.name))) return undefined;
      common = owner;
    }
    return common;
  };
  const ownerOf = (file: string, visiting: Set<string>): Owner | undefined => {
    if (owners.has(file)) return owners.get(file);
    const path = byPath(file);
    if (path.owner) {
      owners.set(file, path.owner);
      return path.owner;
    }
    if (visiting.has(file)) return undefined;
    visiting.add(file);
    const common = shared(file, visiting);
    visiting.delete(file);
    // Core gives its files only to plugins: a core file the adapter alone
    // imports is still core. Outside the forms packages anything goes.
    const owner = path.forms ? (common?.kind === "plugin" ? common : path.fallback) : common;
    owners.set(file, owner);
    return owner;
  };

  const parts = new Map<string, { owner: Owner; minified: number; chunks: Set<string> }>();
  for (const [file, count] of bytes) {
    const owner = ownerOf(file, new Set());
    if (!owner) continue;
    const key = `${owner.kind}:${owner.name}`;
    let part = parts.get(key);
    if (!part) parts.set(key, (part = { owner, minified: 0, chunks: new Set() }));
    part.minified += count;
    for (const name of chunksOf.get(file) ?? []) part.chunks.add(name);
  }
  const order: SizePart["kind"][] = ["core", "adapter", "plugin", "devtools"];
  const ordered = [...parts.values()];
  // A copy, sorted in place: `toSorted` is past the ES2020 the package targets.
  // oxlint-disable-next-line unicorn/no-array-sort
  ordered.sort((a, b) => order.indexOf(a.owner.kind) - order.indexOf(b.owner.kind) || b.minified - a.minified);
  return {
    version: 1,
    bundler,
    builtAt: new Date().toISOString(),
    total: { minified, gzip },
    parts: ordered.map(({ owner, minified: size, chunks: names }) => ({ kind: owner.kind, name: owner.name, minified: size, chunks: sorted(names) })),
  };
}

/** A build of an app's imports from the forms packages, for an app Vite can't build again on its own. */
export interface ImportsJob {
  readonly root: string;
  /** Each forms module the app imports, with the names it imports: `*` for all of it. */
  readonly imports: Readonly<Record<string, readonly string[]>>;
  readonly conditions: readonly string[];
  /** The app's aliases that a worker can receive: a string or RegExp to a path. */
  readonly alias: readonly { readonly find: string | RegExp; readonly replacement: string }[];
}

/** A production build of the app from its Vite config file. */
export interface ConfigJob {
  readonly root: string;
  readonly configFile: string;
}

export type MeasureJob = ImportsJob | ConfigJob;

const entryId = "\0lunarhue-forms-sizes-entry";

/** A sorted copy. `toSorted` is past the ES2020 the package targets. */
// oxlint-disable-next-line unicorn/no-array-sort
export const sorted = (items: Iterable<string>): string[] => [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/** An entry module that keeps exactly what the app imports from each forms module. */
export function entryCode(imports: ImportsJob["imports"]): string {
  let next = 0;
  return sorted(Object.keys(imports))
    .map((source) => {
      const names = imports[source] ?? [];
      const from = JSON.stringify(source);
      if (names.includes("*")) return `export * as _${next++} from ${from};`;
      if (names.length === 0) return `import ${from};`;
      return `export { ${sorted(names).map((name) => `${name === "default" ? "default" : name} as _${next++}`).join(", ")} } from ${from};`;
    })
    .join("\n");
}

/**
 * Leaves out what a forms package doesn't ship inside it: everything outside
 * the forms packages, except a dependency a package bundles into its build
 * (one it doesn't install alongside it, like the panel's Preact).
 */
const externals: Plugin = {
  name: "lunarhue-forms:sizes-externals",
  enforce: "pre",
  resolveId(source, importer) {
    if (importer === undefined || importer === entryId || /^[./\0]/.test(source) || /^[a-z]:/i.test(source) || isForms(source)) return null;
    const bare = source.startsWith("@") ? source.split("/").slice(0, 2).join("/") : source.split("/")[0]!;
    const owner = packageOf(fileOf(importer));
    if (owner && isForms(owner.name) && !owner.installs.has(bare)) return null;
    return { id: source, external: true };
  },
};

/** Whether `id` is a module of one of the forms packages. */
export const isFormsModule = (id: string): boolean => isForms(packageOf(fileOf(id))?.name);

type GenerateBundle = Extract<NonNullable<Plugin["generateBundle"]>, { handler: unknown }>["handler"];

/** Adds the report to a build's output, from a `generateBundle` hook and its context. */
export function emitReport(context: ThisParameterType<GenerateBundle>, ...[options, bundle]: Parameters<GenerateBundle>): void {
  const chunks = Object.values(bundle).filter((file): file is Rolldown.OutputChunk => file.type === "chunk");
  const { root, build } = context.environment.config;
  const report = sizeReport(chunks, options.dir ?? resolve(root, build.outDir), (id) => context.getModuleInfo(id));
  context.emitFile({ type: "asset", fileName: reportFile, source: JSON.stringify(report) });
}

function viteConfig(job: MeasureJob): InlineConfig {
  const shared: InlineConfig = { root: job.root, mode: "production", logLevel: "silent" };
  if ("configFile" in job) return { ...shared, configFile: job.configFile, build: { write: false } };
  return {
    ...shared,
    configFile: false,
    resolve: { conditions: [...job.conditions], alias: job.alias.map((entry) => ({ ...entry })) },
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    plugins: [
      externals,
      { name: "lunarhue-forms:sizes-entry", resolveId: (id) => (id === entryId ? id : null), load: (id) => (id === entryId ? entryCode(job.imports) : null) },
      { name: "lunarhue-forms:sizes-report", generateBundle: { order: "post", handler(options, bundle, isWrite) { emitReport(this, options, bundle, isWrite); } } },
    ],
    build: {
      write: false,
      sourcemap: "hidden",
      modulePreload: false,
      copyPublicDir: false,
      rollupOptions: { input: entryId, preserveEntrySignatures: "exports-only" },
    },
  };
}

/** Runs the job's build in this thread and returns the report it emitted, as JSON. */
export async function measure(job: MeasureJob): Promise<string> {
  const { build } = await import("vite");
  const result = await build(viteConfig(job));
  // Without `watch`, a build returns its output, not a watcher.
  for (const output of Array.isArray(result) ? result : [result]) {
    for (const file of "output" in output ? output.output : []) {
      if (file.type === "asset" && file.fileName === reportFile) return typeof file.source === "string" ? file.source : Buffer.from(file.source).toString("utf8");
    }
  }
  throw new Error("the build emitted no size report. Is formsDevtools() in its plugins?");
}

const workerKey = "lunarhueFormsSizes";

/**
 * Runs `measure` on a worker thread, so the build has a production
 * `NODE_ENV` and plugins of its own, and the dev server keeps answering.
 */
export function measureInWorker(job: MeasureJob): Promise<string> {
  return new Promise((done, fail) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { [workerKey]: job },
      env: { ...process.env, NODE_ENV: "production" },
    });
    worker.once("message", (message: { report?: string; error?: string }) => {
      if (message.report !== undefined) done(message.report);
      else fail(new Error(message.error));
      void worker.terminate();
    });
    worker.once("error", fail);
    worker.once("exit", (code) => fail(new Error(`the size worker exited with code ${code}`)));
  });
}

// On the worker: run the job `measureInWorker` passed, and post back its report.
const data: unknown = isMainThread ? undefined : workerData;
const job: unknown = data !== null && typeof data === "object" ? Reflect.get(data, workerKey) : undefined;
if (job !== undefined && parentPort !== null) {
  const port = parentPort;
  // A worker's port takes no target origin, unlike a window's.
  /* oxlint-disable unicorn/require-post-message-target-origin */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  measure(job as MeasureJob).then(
    (report) => port.postMessage({ report }),
    (error: unknown) => port.postMessage({ error: error instanceof Error ? (error.stack ?? error.message) : String(error) }),
  );
  /* oxlint-enable unicorn/require-post-message-target-origin */
}
