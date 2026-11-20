/// <reference types="node" />
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, optimize } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

// The panel's stylesheet is Tailwind, compiled when something builds the
// panel: tsdown for dist, and Vite wherever the panel is built from source
// (the package's tests, the docs and the e2e apps). The panel imports it as
// `virtual:lunarhue/panel-css`, a string it puts in its shadow root.

const stylesheet = fileURLToPath(new URL("./src/panel/styles.css", import.meta.url));
const publicId = "virtual:lunarhue/panel-css";
const id = "\0lunarhue:panel-css";

/**
 * Tailwind gives its `--tw-*` variables their starting values with
 * `@property`, which a shadow root ignores. Its fallback for browsers without
 * `@property` sits behind an `@supports` that Chromium fails, so this repeats
 * every starting value on every element of the shadow root.
 */
function shadowDefaults(css: string): string {
  const values = [...css.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]*)\}/g)].map(([, name, body]) => {
    const initial = /initial-value\s*:\s*([^;]+)/.exec(body ?? "")?.[1]?.trim();
    return `${name}: ${initial ?? "initial"};`;
  });
  return values.length === 0 ? css : `${css}\n@layer properties {\n*, ::before, ::after, ::backdrop {\n${values.join("\n")}\n}\n}\n`;
}

/** Compiles the panel's stylesheet with the classes its sources use. `watch` hears of every file it read. */
export async function panelStyles(watch: (file: string) => void = () => {}): Promise<string> {
  watch(stylesheet);
  const compiler = await compile(await readFile(stylesheet, "utf8"), { base: dirname(stylesheet), onDependency: watch });
  const scanner = new Scanner({ sources: compiler.sources });
  const candidates = scanner.scan();
  for (const file of scanner.files) watch(file);
  return optimize(shadowDefaults(compiler.build(candidates)), { minify: true }).code;
}

/** The parts of a Vite dev server the plugin uses. Rolldown never calls `configureServer`. */
interface DevServer {
  readonly watcher: { add(files: string[]): void; on(event: "change", listener: (file: string) => void): void };
  readonly moduleGraph: { getModuleById(id: string): object | undefined; invalidateModule(module: object): void };
  readonly ws: { send(payload: { type: "full-reload" }): void };
}

/**
 * A Vite and Rolldown plugin that serves `virtual:lunarhue/panel-css`. In a
 * Vite dev server, a change to a file the stylesheet read rebuilds it and
 * reloads the page. The files go to the server's watcher, not to
 * `addWatchFile`: that would put styles.css in the module graph, and Astro
 * adds every stylesheet in a page's graph to the page.
 */
export function panelCss() {
  const read = new Set<string>();
  return {
    name: "lunarhue:panel-css",
    enforce: "pre" as const,
    resolveId: (source: string) => (source === publicId ? id : null),
    async load(loaded: string) {
      if (loaded !== id) return null;
      return `export default ${JSON.stringify(await panelStyles((file) => read.add(file)))};`;
    },
    configureServer(server: DevServer) {
      server.watcher.add([dirname(stylesheet)]);
      server.watcher.on("change", (file) => {
        const module = server.moduleGraph.getModuleById(id);
        if (!read.has(file) || module === undefined) return;
        server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
