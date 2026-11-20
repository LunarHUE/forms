// @vitest-environment node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createServer, type Rolldown, type ViteDevServer } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import type { SizeReport } from "./sizes.js";
import { entryCode, reportFile, sizeReport } from "./vite/measure.js";

const app = join(dirname(fileURLToPath(import.meta.url)), "vite", "fixtures", "app");
const configFile = join(app, "vite.config.ts");

const byName = (report: SizeReport) => Object.fromEntries(report.parts.map((part) => [`${part.kind}:${part.name}`, part]));

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const asReport = (json: unknown) => json as SizeReport;

async function buildApp(sourcemap = false, clientMaps?: boolean) {
  const environments = clientMaps === undefined ? {} : { environments: { client: { build: { sourcemap: clientMaps } } } };
  const result = await build({ configFile, build: { write: false, sourcemap }, ...environments });
  return (Array.isArray(result) ? result : [result]).flatMap((output) => ("output" in output ? output.output : []));
}

/** A chunk with just what `sizeReport` reads. */
const chunk = (fileName: string, code: string, sources: string[], mappings: string) =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  ({ type: "chunk", fileName, code, modules: Object.fromEntries(sources.map((source) => [source, {}])), map: { sources, mappings } }) as unknown as Rolldown.OutputChunk;

/** Asks the server for its report until one is ready. */
async function served(dev: ViteDevServer): Promise<SizeReport> {
  for (let attempt = 0; attempt < 300; attempt++) {
    const response = await fetch(new URL("/@lunarhue/forms-sizes.json", dev.resolvedUrls?.local[0]));
    if (response.ok) return asReport(await response.json());
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error("no report");
}

describe("sizeReport", () => {
  it("gives each byte to the file its segment maps it to, across line ends", () => {
    // Line 1: `aaaa` from a.ts, then `bb` from b.ts. Line 2 has no segment, so it continues b.ts.
    const report = sizeReport([chunk("assets/x.js", "aaaabb\ncc", ["../a.ts", "../b.ts"], "AAAA,IACA;")], "/out", () => null);
    expect(report.total.minified).toBe(9);
    // Neither file is in a forms package, so no part.
    expect(report.parts).toEqual([]);
  });

  it("gives a core file only one plugin imports to that plugin, and a shared one to core", () => {
    const core = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "core", "src");
    const [mask, caret, define, store, index] = ["plugins/mask.ts", "plugins/caret.ts", "store/define.ts", "store/core.ts", "plugins/index.ts"].map((file) => join(core, file));
    // The plugins index imports the caret helpers too, but puts no bytes in the build.
    const importers: Record<string, string[]> = { [caret!]: [mask!, index!], [define!]: [mask!, store!] };
    const report = sizeReport(
      [chunk("x.js", "mmmmmcccccdddddsssss", [mask!, caret!, define!, store!], "AAAA,KCAA,KCAA,KCAA")],
      "/",
      (id) => ({ importers: importers[id] ?? [], dynamicImporters: [] }),
    );
    expect(report.parts.map(({ kind, name, minified }) => ({ kind, name, minified }))).toEqual([
      { kind: "core", name: "@lunarhue/forms-core", minified: 10 },
      { kind: "plugin", name: "mask", minified: 10 },
    ]);
  });
});

describe("entryCode", () => {
  it("re-exports exactly what the app imports", () => {
    expect(entryCode({ "@lunarhue/forms-core/plugins": ["mask", "history"], "@lunarhue/forms-devtools": ["*"], "@lunarhue/forms-react": [] })).toBe(
      [
        "export { history as _0, mask as _1 } from \"@lunarhue/forms-core/plugins\";",
        "export * as _2 from \"@lunarhue/forms-devtools\";",
        "import \"@lunarhue/forms-react\";",
      ].join("\n"),
    );
  });
});

describe("vite build", () => {
  it("emits the report and defines its URL", async () => {
    const output = await buildApp();
    const asset = output.find((file) => file.fileName === reportFile);
    if (asset?.type !== "asset") throw new Error("no report asset");
    const report = asReport(JSON.parse(String(asset.source)));
    const parts = byName(report);
    expect(Object.keys(parts)).toEqual(["core:@lunarhue/forms-core", "plugin:history", "plugin:mask", "devtools:devtools"]);
    // The app never imports rules(), so it isn't in the report.
    expect(parts["plugin:rules"]).toBeUndefined();
    const sum = report.parts.reduce((total, part) => total + part.minified, 0);
    expect(sum).toBeLessThanOrEqual(report.total.minified);
    expect(report.total.gzip).toBeLessThan(report.total.minified);
    // The lazy panel chunk counts toward the devtools.
    expect(parts["devtools:devtools"]?.chunks.some((name) => name.includes("panel"))).toBe(true);
    const code = output.flatMap((file) => (file.type === "chunk" ? [file.code] : [])).join("\n");
    expect(code).toContain(`/${reportFile}`);
  });

  it("drops the source maps it added, and keeps the ones the app asked for", async () => {
    expect((await buildApp()).some((file) => file.fileName.endsWith(".map"))).toBe(false);
    expect((await buildApp(true)).some((file) => file.fileName.endsWith(".map"))).toBe(true);
  });

  it("measures a client environment that turns its maps off, as Astro's does", async () => {
    const output = await buildApp(true, false);
    expect(output.some((file) => file.fileName.endsWith(".map"))).toBe(false);
    const asset = output.find((file) => file.fileName === reportFile);
    if (asset?.type !== "asset") throw new Error("no report asset");
    expect(asReport(JSON.parse(String(asset.source))).parts.length).toBeGreaterThan(0);
  });
});

describe("vite dev", () => {
  let server: ViteDevServer | undefined;
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it("builds the app from its config file in the background and serves the report", async () => {
    server = await createServer({ configFile, configLoader: "runner", server: { port: 0, ws: false } });
    await server.listen();
    const parts = byName(await served(server));
    expect(Object.keys(parts)).toEqual(["core:@lunarhue/forms-core", "plugin:history", "plugin:mask", "devtools:devtools"]);
  });

  it("defines the URL as a global the devtools' module sets from the dev server", async () => {
    server = await createServer({ configFile, configLoader: "runner", server: { port: 0, ws: false } });
    const sizes = await server.transformRequest(join(dirname(fileURLToPath(import.meta.url)), "sizes.ts"));
    expect(sizes?.code).toContain('globalThis[Symbol.for("lunarhue.forms.sizes")]');
    expect(sizes?.code).toContain('import.meta.hot.on("lunarhue-forms:sizes"');
  });
});
