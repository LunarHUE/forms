import { h, type JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { FormEntry } from "../hook.js";
import { type SizePart, type SizeReport, sizesUrl } from "../sizes.js";

/** A row of the Bundle tab: a part the form uses, by the `kind` and `name` a report names it with. */
export interface BundleRow {
  readonly kind: SizePart["kind"];
  /** The name a report uses. Undefined for an adapter that hasn't reported itself. */
  readonly name: string | undefined;
  readonly label: string;
}

/** Core, the adapter, then every plugin on the form in hook order, ours and third-party alike. */
export function bundleRows(entry: FormEntry): BundleRow[] {
  return [
    { kind: "core", name: "@lunarhue/forms-core", label: "@lunarhue/forms-core" },
    { kind: "adapter", name: entry.adapter, label: entry.adapter ?? "adapter" },
    ...entry.ctx.installed.map((plugin): BundleRow => {
      // devtools() is this package, which a report counts as a whole.
      const kind = plugin.name === "devtools" ? "devtools" : "plugin";
      return { kind, name: plugin.name, label: `${plugin.name}()` };
    }),
  ];
}

/** The report's part for `row`, matched by kind and name. */
export const partFor = (report: SizeReport | undefined, row: BundleRow): SizePart | undefined =>
  report?.parts.find((part) => part.kind === row.kind && part.name === row.name);

/** Bytes as size-limit shows them: kilobytes of 1000 bytes. */
export const bytes = (count: number): string => (count < 1000 ? `${count} B` : `${(count / 1000).toFixed(2)} kB`);

type Load = { readonly state: "loading" } | { readonly state: "done"; readonly report: SizeReport } | { readonly state: "failed"; readonly reason: string };

// One fetch per URL for the page's life: the report only changes with a new build.
const loads = new Map<string, Promise<Load>>();

const isReport = (value: unknown): value is SizeReport =>
  value !== null && typeof value === "object" && Reflect.get(value, "version") === 1 && Array.isArray(Reflect.get(value, "parts"));

function load(url: string): Promise<Load> {
  let pending = loads.get(url);
  if (pending === undefined) {
    pending = fetch(url)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then(
        (body: unknown): Load =>
          isReport(body) ? { state: "done", report: body } : { state: "failed", reason: "it isn't a version 1 size report" },
      )
      .catch((error: unknown): Load => ({ state: "failed", reason: error instanceof Error ? error.message : String(error) }));
    loads.set(url, pending);
  }
  return pending;
}

/** The size report, fetched the first time the tab opens. Undefined when no bundler plugin defined its URL. */
function useReport(url: string | undefined): Load | undefined {
  const [result, setResult] = useState<Load | undefined>(url === undefined ? undefined : { state: "loading" });
  useEffect(() => {
    if (url === undefined) return undefined;
    let live = true;
    void load(url).then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, [url]);
  return result;
}

/** Where the sizes come from, or why there are none. */
function source(url: string | undefined, result: Load | undefined): JSX.Element {
  if (url === undefined || result === undefined) {
    return h(
      "p",
      { class: "note" },
      "Sizes come from your production build. Add ",
      h("code", null, "@lunarhue/forms-devtools/vite"),
      " to your Vite config to measure them.",
    );
  }
  if (result.state === "loading") return h("p", { class: "note" }, "Reading the size report...");
  if (result.state === "failed") return h("p", { class: "note error" }, `Couldn't read the size report at ${url}: ${result.reason}.`);
  const { report } = result;
  const built = new Date(report.builtAt);
  return h(
    "p",
    { class: "note" },
    `measured, from the build at ${Number.isNaN(built.getTime()) ? report.builtAt : built.toLocaleString()}`,
    h("span", { class: "muted" }, ` by ${report.bundler}`),
  );
}

const dash = (title: string) => h("span", { class: "muted", title }, "–");

/** The Bundle tab: the parts the form uses and, once a bundler plugin measured the build, the bytes each adds. */
export function Bundle({ entry }: { readonly entry: FormEntry }): JSX.Element {
  const url = sizesUrl();
  const result = useReport(url);
  const report = result?.state === "done" ? result.report : undefined;
  const missing = report
    ? "The report has no part with this kind and name."
    : "Sizes come from your production build. Add @lunarhue/forms-devtools/vite to measure them.";
  return h(
    "div",
    { class: "bundle scroll" },
    source(url, result),
    h(
      "table",
      { class: "sizes", "aria-label": "Bundle" },
      h("thead", null, h("tr", null, h("th", null, "part"), h("th", null, "kind"), h("th", { class: "num" }, "minified"))),
      h(
        "tbody",
        null,
        bundleRows(entry).map((row) => {
          const part = partFor(report, row);
          return h(
            "tr",
            { key: `${row.kind}:${row.label}`, "data-part": `${row.kind}:${row.name ?? ""}` },
            h("td", null, row.name === undefined ? h("span", { class: "muted" }, "adapter not reported") : row.label),
            h("td", { class: "muted" }, row.kind),
            h("td", { class: "num" }, part ? h("span", { title: part.chunks.join("\n") }, bytes(part.minified)) : dash(missing)),
          );
        }),
      ),
      report
        ? h(
            "tfoot",
            null,
            h(
              "tr",
              null,
              h("th", null, "whole app"),
              h("td", { class: "muted" }, `${bytes(report.total.gzip)} gzip`),
              h("td", { class: "num" }, bytes(report.total.minified)),
            ),
          )
        : null,
    ),
  );
}
