import type { Plugin, Rolldown, ViteDevServer } from "vite";
import { emitReport, formsPackage, isFormsModule, measureInWorker, type MeasureJob, reportFile, sorted } from "./vite/measure.js";

/** The define the panel reads the report's URL from (sizes.ts). */
const sizesDefine = "__LUNARHUE_FORMS_SIZES__";
/** In dev the define's place takes this global, which the dev server sets once a report is ready. */
const devGlobal = 'globalThis[Symbol.for("lunarhue.forms.sizes")]';
const event = "lunarhue-forms:sizes";
const devPath = "@lunarhue/forms-sizes.json";
/** How long the source has to stay unchanged before dev measures again. */
const settle = 1000;

/** The report's URL in a build, as an expression. A relative `base` resolves against the page. */
function builtUrl(base: string): string {
  if (/^(\/|[a-z]+:)/i.test(base)) return JSON.stringify(`${base.replace(/\/?$/, "/")}${reportFile}`);
  return `(typeof document === "undefined" ? undefined : new URL(${JSON.stringify(`${base.replace(/^\.?\/?/, "").replace(/([^/])$/, "$1/")}${reportFile}`)}, document.baseURI).href)`;
}

/**
 * Appended to the module that reads the define: it asks the dev server for
 * the current report's URL and takes each new one.
 */
const listener = `
if (import.meta.hot) {
  import.meta.hot.on(${JSON.stringify(event)}, (data) => { ${devGlobal} = data.url; });
  import.meta.hot.send(${JSON.stringify(event)});
}
`;

const isDevtoolsModule = (id: string, code: string) =>
  code.includes(sizesDefine) && /[/\\](forms-devtools|packages[/\\]devtools)[/\\]/.test(id);

const formsImport = /["']@lunarhue\/forms-(?:core|react|solid|vue|schema|bind|devtools)\b/;

type Program = ReturnType<Rolldown.PluginContext["parse"]>;

/** An import or export's name: an identifier, or a string as in `export { "a-b" as c }`. */
const nameOf = (node: { type: string; name?: string; value?: unknown }): string => node.name ?? String(node.value);

/** Every forms module `program` imports, with the names it imports. */
function formsImports(program: Program, code: string): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  const add = (source: unknown, name?: string) => {
    if (typeof source !== "string" || !formsPackage.test(source)) return;
    let names = found.get(source);
    if (!names) found.set(source, (names = new Set()));
    if (name !== undefined) names.add(name);
  };
  for (const node of program.body) {
    if (node.type === "ImportDeclaration") {
      add(node.source.value);
      for (const specifier of node.specifiers) {
        if (specifier.type === "ImportSpecifier") add(node.source.value, nameOf(specifier.imported));
        else if (specifier.type === "ImportDefaultSpecifier") add(node.source.value, "default");
        else add(node.source.value, "*");
      }
    } else if (node.type === "ExportNamedDeclaration" && node.source) {
      for (const specifier of node.specifiers) add(node.source.value, nameOf(specifier.local));
    } else if (node.type === "ExportAllDeclaration") {
      add(node.source.value, "*");
    }
  }
  // A dynamic import keeps the whole module.
  for (const match of code.matchAll(/\bimport\(\s*["'](@lunarhue\/forms-[^"']+)["']\s*\)/g)) add(match[1], "*");
  return found;
}

/** A module's forms imports as a string that two equal sets share. */
const importsKey = (map: Map<string, Set<string>> | undefined): string =>
  JSON.stringify(sorted([...(map ?? [])].map(([source, names]) => JSON.stringify([source, sorted(names)]))));

/**
 * Measures what the forms packages add to your production build, for the
 * devtools panel's Bundle tab.
 *
 * In `vite build` it writes the report next to your build's output. In dev it
 * builds your app for production in the background when the server starts
 * and again a second after your source stops changing, writing nothing, and
 * serves the report from the dev server. Vite builds the app from your
 * config file. A framework that hands Vite its config inline, like Astro,
 * leaves no config file to build from, so there the plugin builds what your
 * app's modules import from the forms packages, once the browser loads them.
 *
 * @example
 * ```ts
 * import { formsDevtools } from "@lunarhue/forms-devtools/vite";
 *
 * export default defineConfig({ plugins: [formsDevtools()] });
 * ```
 */
export function formsDevtools(): Plugin[] {
  let command: "build" | "serve" = "serve";
  let topMaps: unknown;
  /** The environments whose source maps the plugin turned on. */
  const mapsAdded = new Set<string>();
  let server: ViteDevServer | undefined;
  /** Forms imports by importing module, in dev without a config file. */
  const imports = new Map<string, Map<string, Set<string>>>();
  let scheduleMeasure: (() => void) | undefined;

  const sizes: Plugin = {
    name: "lunarhue-forms:sizes",
    config(config, env) {
      command = env.command;
      if (env.command === "build") {
        topMaps = config.build?.sourcemap;
        return { define: { [sizesDefine]: builtUrl(config.base ?? "/") } };
      }
      // In dev the listener below stands in for the define, in the
      // devtools' own modules, which an optimized dependency wouldn't pass
      // through. A dev define would be a page global, set once at load.
      return { optimizeDeps: { exclude: ["@lunarhue/forms-devtools"] } };
    },
    configEnvironment(name, config, env) {
      if (env.command !== "build" || (config.consumer ?? (name === "client" ? "client" : "server")) !== "client") return null;
      // Attribution reads the chunks' source maps. Without maps asked for,
      // the build makes hidden ones and drops them before writing. Astro
      // sets the client's maps itself, so this goes on the environment.
      if (config.build?.sourcemap ?? topMaps) return null;
      mapsAdded.add(name);
      return { build: { sourcemap: "hidden" } };
    },
    generateBundle: {
      order: "post",
      handler(options, bundle, isWrite) {
        if (command !== "build" || this.environment.config.consumer !== "client") return;
        emitReport(this, options, bundle, isWrite);
        if (!mapsAdded.has(this.environment.name)) return;
        for (const file of Object.values(bundle)) {
          if (file.type === "chunk" && file.sourcemapFileName) Reflect.deleteProperty(bundle, file.sourcemapFileName);
        }
      },
    },
    configureServer(dev) {
      server = dev;
      const configFile = dev.config.configFile;
      const path = `${dev.config.base.replace(/\/?$/, "/")}${devPath}`;
      let report: string | undefined;
      let version = 0;
      const url = () => (report === undefined ? undefined : `${path}?build=${version}`);

      dev.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== path) return next();
        if (report === undefined) {
          response.statusCode = 404;
          response.end("The forms size report isn't ready yet.");
          return;
        }
        response.setHeader("content-type", "application/json");
        response.setHeader("cache-control", "no-store");
        response.end(report);
      });
      dev.ws.on(event, (_data, client) => client.send(event, { url: url() }));

      let timer: ReturnType<typeof setTimeout> | undefined;
      let running = false;
      let again = false;
      let warned = false;
      const job = (): MeasureJob | undefined => {
        if (configFile) return { root: dev.config.root, configFile };
        const merged: Record<string, Set<string>> = {};
        for (const found of imports.values()) {
          for (const [source, names] of found) for (const name of names) (merged[source] ??= new Set()).add(name);
          for (const source of found.keys()) merged[source] ??= new Set();
        }
        if (Object.keys(merged).length === 0) return undefined;
        return {
          root: dev.config.root,
          conditions: dev.environments.client.config.resolve.conditions,
          alias: dev.config.resolve.alias.flatMap(({ find, replacement, customResolver }) => (customResolver ? [] : [{ find, replacement }])),
          imports: Object.fromEntries(Object.entries(merged).map(([source, names]) => [source, [...names]])),
        };
      };
      const run = async () => {
        const next = job();
        if (next === undefined) return;
        if (running) {
          again = true;
          return;
        }
        running = true;
        try {
          report = await measureInWorker(next);
          version += 1;
          dev.ws.send(event, { url: url() });
        } catch (error) {
          if (!warned) dev.config.logger.warn(`[forms-devtools] Couldn't measure the build for the Bundle tab: ${error instanceof Error ? error.message : String(error)}`);
          warned = true;
        } finally {
          running = false;
        }
        if (again) {
          again = false;
          scheduleMeasure?.();
        }
      };
      scheduleMeasure = () => {
        clearTimeout(timer);
        timer = setTimeout(() => void run(), settle);
      };
      dev.watcher.on("all", () => scheduleMeasure?.());
      dev.httpServer?.once("close", () => clearTimeout(timer));
      if (configFile) void run();
    },
  };

  const listen: Plugin = {
    name: "lunarhue-forms:sizes-listener",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      if (this.environment.config.consumer !== "client" || !isDevtoolsModule(id, code)) return null;
      // The TypeScript source declares the define; that line stays.
      return { code: code.replace(/(?<!declare const )\b__LUNARHUE_FORMS_SIZES__\b/g, devGlobal) + listener, map: null };
    },
  };

  const collect: Plugin = {
    name: "lunarhue-forms:sizes-imports",
    apply: "serve",
    enforce: "post",
    transform(code, id) {
      if (server?.config.configFile || this.environment.config.consumer !== "client") return null;
      // The forms packages import each other; only the app's imports count.
      if (/[/\\]node_modules[/\\]/.test(id) || isFormsModule(id)) return null;
      if (!formsImport.test(code)) {
        if (imports.delete(id)) scheduleMeasure?.();
        return null;
      }
      let found: Map<string, Set<string>>;
      try {
        found = formsImports(this.parse(code), code);
      } catch {
        return null;
      }
      if (importsKey(found) !== importsKey(imports.get(id))) {
        imports.set(id, found);
        scheduleMeasure?.();
      }
      return null;
    },
  };

  return [sizes, listen, collect];
}
