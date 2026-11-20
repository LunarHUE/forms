/** @jsxImportSource preact */
import type { JSX } from "preact";
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
    return (
      <p class="note">
        Sizes come from your production build. Add <code>@lunarhue/forms-devtools/vite</code> to your Vite config to measure them.
      </p>
    );
  }
  if (result.state === "loading") return <p class="note">Reading the size report...</p>;
  if (result.state === "failed") return <p class="note error">{`Couldn't read the size report at ${url}: ${result.reason}.`}</p>;
  const { report } = result;
  const built = new Date(report.builtAt);
  return (
    <p class="note">
      {`measured, from the build at ${Number.isNaN(built.getTime()) ? report.builtAt : built.toLocaleString()}`}
      <span class="muted">{` by ${report.bundler}`}</span>
    </p>
  );
}

const sum = (items: readonly ({ readonly size: number | undefined } | undefined)[]) => items.reduce((total, item) => total + (item?.size ?? 0), 0);

/** A bar of the graph, as wide as its share of its row. */
const bar = (label: string, size: number | undefined, grow: number, part?: string) => (
  <div
    class="bar-part"
    style={`flex-grow: ${grow}`}
    data-part={part}
    data-tip={size === undefined ? `${label}, not measured` : `${label} ${bytes(size)}`}
  >
    <span class="truncate">{label}</span>
    <span class="num">{size === undefined ? "–" : (size / 1000).toFixed(1)}</span>
  </div>
);

/**
 * The Bundle tab: a graph of the bytes the forms packages add, core, the
 * adapter and the plugins under their total and each plugin under the
 * plugins, then the plugins in the order their hooks run. The sizes come from
 * a bundler plugin's report; until one measured the build, the bars are
 * even and show no sizes.
 */
export function Bundle({ entry }: { readonly entry: FormEntry }): JSX.Element {
  const url = sizesUrl();
  const result = useReport(url);
  const report = result?.state === "done" ? result.report : undefined;
  const rows = bundleRows(entry);
  const sized = rows.map((row) => ({ row, size: partFor(report, row)?.minified }));
  // devtools() is for development, so the graph leaves it out.
  const [core, adapter, ...plugins] = sized;
  const shipped = plugins.filter(({ row }) => row.kind === "plugin");
  const pluginBytes = sum(shipped);
  const total = sum([core, adapter]) + pluginBytes;
  // Without sizes every bar weighs the same.
  const weigh = (size: number | undefined) => (report ? (size ?? 0) : 1);
  const top = [core, adapter].map((item) => weigh(item?.size));
  const pluginsWeight = report ? pluginBytes : 1;
  const start = (100 * ((top[0] ?? 0) + (top[1] ?? 0))) / ((top[0] ?? 0) + (top[1] ?? 0) + pluginsWeight || 1);
  return (
    <div class="bundle scroll">
      {source(url, result)}
      <div class="graph" aria-label="Bundle">
        <div class="graph-head">
          <span class="muted">forms packages</span>
          {report ? (
            <span class="muted">
              whole app <span class="fg">{bytes(report.total.minified)}</span>
              {` · ${bytes(report.total.gzip)} gzip`}
            </span>
          ) : null}
        </div>
        <div class="bar-row">{bar("minified", report ? total : undefined, 1)}</div>
        <div class="bar-row">
          {core ? bar("core", core.size, top[0] ?? 1, `core:${core.row.name ?? ""}`) : null}
          {adapter ? bar(adapter.row.name ?? "adapter", adapter.size, top[1] ?? 1, `adapter:${adapter.row.name ?? ""}`) : null}
          {shipped.length > 0 ? bar("plugins", report ? pluginBytes : undefined, pluginsWeight) : null}
        </div>
        {shipped.length > 0
          ? [
              <svg class="wedge" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                <path d={`M${start} 0H100V10H0z`} />
              </svg>,
              <div class="bar-row">{shipped.map(({ row, size }) => bar(row.name ?? "", size, weigh(size)))}</div>,
            ]
          : null}
      </div>
      <ol class="runs" aria-label="Run order">
        <li class="runs-head muted">Run order</li>
        {plugins.map(({ row, size }, index) => (
          <li key={row.label} data-part={`${row.kind}:${row.name ?? ""}`}>
            <span class="muted">{index + 1}</span>
            <span class="truncate">{row.name}</span>
            <span class="num">
              {size !== undefined ? (
                bytes(size)
              ) : row.kind === "devtools" && report ? (
                <span class="muted">dev only</span>
              ) : (
                <span class="muted" title={report ? "The report has no part with this kind and name." : "Not measured"}>
                  –
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
