import { cn } from "cn";
import { useEffect, useState, type ComponentType, type KeyboardEvent } from "react";

import {
  BUILD_LABELS,
  COMPRESSION_LABELS,
  COMPRESSIONS,
  formatBytes,
  sizeRows,
  type AppSizes,
  type CompareLibrary,
  type Compression,
  type Delta,
  type SizeRow,
} from "@/lib/compare";

import { DemoFrame, type DemoFile } from "./DemoFrame";
import { DemoTabs } from "./demo/DemoTabs";

export interface CompareFrameBuild {
  readonly library: CompareLibrary;
  /** "@lunarhue/forms" or "TanStack Form". */
  readonly title: string;
  readonly version: string;
  /** App.tsx first. */
  readonly files: readonly DemoFile[];
}

export interface CompareFrameProps {
  /** Unique on the page. Prefixes the element ids. */
  id: string;
  /** The app's folder in examples/compare, like `signup`. */
  app: string;
  /** Ours first. */
  builds: readonly CompareFrameBuild[];
  /** From examples/compare/sizes.json. */
  sizes: AppSizes;
}

interface AppModule {
  App: ComponentType;
}

// Each app is its own chunk, so a page loads only its app, and TanStack's
// build only once the reader picks it. These are the same App.tsx files
// scripts/size-compare.ts measures through each app's main.tsx.
const appModules = import.meta.glob<AppModule>("../../../../../examples/compare/*/*/App.tsx");
const loaded = new Map<string, ComponentType>();

function appPath(app: string, library: CompareLibrary): string {
  return `../../../../../examples/compare/${app}/${library}/App.tsx`;
}

/** The colour that marks each library: the docs' brand for ours, TanStack's amber for theirs. */
const LIBRARY_DOT: Record<CompareLibrary, string> = {
  lunarhue: "bg-brand",
  tanstack: "bg-amber-500",
};

/**
 * The comparison block: a library switch above the demo frame, whose Preview
 * runs the picked build's app and whose file tabs show that build's code,
 * then the measured sizes of both builds.
 *
 * Switching libraries mounts the other app fresh. Both apps use the same
 * input ids, so keeping the hidden one mounted would point its labels at the
 * wrong inputs. An open file stays open when the other build has it too.
 */
export function CompareFrame({ id, app, builds, sizes }: CompareFrameProps) {
  const [library, setLibrary] = useState<CompareLibrary>(builds[0]?.library ?? "lunarhue");
  // Bumped by Reset. A new key mounts the app again.
  const [mounts, setMounts] = useState(0);
  // False until the first switch or reset. Before that the app must start
  // from the server's loading line to hydrate, even when a client-router
  // visit already loaded its chunk.
  const [touched, setTouched] = useState(false);
  const build = builds.find((candidate) => candidate.library === library) ?? builds[0];
  if (!build) return null;
  const elementId = (part: string) => `${id}-${part}`.replace(/[^\w-]/g, "-");

  return (
    <DemoFrame
      id={id}
      name={`compare/${app}`}
      files={[...build.files]}
      onReset={() => {
        setTouched(true);
        setMounts((count) => count + 1);
      }}
      stageClassName="compare-stage"
      codeClassName="max-h-144 overflow-y-auto"
      header={
        <LibrarySwitch
          builds={builds}
          value={build.library}
          onChange={(next) => {
            setTouched(true);
            setLibrary(next);
          }}
        />
      }
      footer={<CompareSizes builds={builds} current={build.library} sizes={sizes} elementId={elementId} />}
    >
      <div className="compare-app" data-library={build.library}>
        <p className="compare-badge">
          {build.title} <span>{build.version}</span>
        </p>
        <LiveApp key={`${build.library}-${mounts}`} path={appPath(app, build.library)} cached={touched} />
      </div>
    </DemoFrame>
  );
}

interface LiveAppProps {
  /** The App.tsx to load, as `appModules` keys it. */
  path: string;
  /** Start from a chunk loaded before, skipping the loading line. Never while hydrating. */
  cached: boolean;
}

/** Loads one app's chunk and renders it. Client only: the server renders the loading line. */
function LiveApp({ path, cached }: LiveAppProps) {
  const [App, setApp] = useState<ComponentType | undefined>(() => (cached ? loaded.get(path) : undefined));

  useEffect(() => {
    if (App) return undefined;
    const load = appModules[path];
    if (!load) throw new Error(`No comparison app at ${path}.`);
    let live = true;
    void load().then((module) => {
      loaded.set(path, module.App);
      if (live) setApp(() => module.App);
    });
    return () => {
      live = false;
    };
  }, [App, path]);

  return App ? <App /> : <p role="status">Loading...</p>;
}

interface LibrarySwitchProps {
  builds: readonly CompareFrameBuild[];
  value: CompareLibrary;
  onChange: (library: CompareLibrary) => void;
}

/** A segmented switch between the builds. Left and right arrows move along it. */
function LibrarySwitch({ builds, value, onChange }: LibrarySwitchProps) {
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = (builds.findIndex((build) => build.library === value) + step + builds.length) % builds.length;
    const next = builds[index];
    if (!next) return;
    onChange(next.library);
    event.currentTarget.querySelectorAll<HTMLElement>("button")[index]?.focus();
  }

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-background px-2 py-1.5">
      <div
        role="group"
        aria-label="Library"
        className="inline-flex min-w-0 rounded-md border bg-muted p-0.5"
        onKeyDown={onKeyDown}
      >
        {builds.map((build) => (
          <button
            key={build.library}
            type="button"
            aria-pressed={build.library === value}
            onClick={() => onChange(build.library)}
            className="inline-flex h-7 items-center gap-2 rounded-[5px] px-2.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs aria-pressed:ring-1 aria-pressed:ring-border"
          >
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", LIBRARY_DOT[build.library])} />
            {build.title}
            <span className="hidden font-normal text-muted-foreground tabular-nums sm:inline">{build.version}</span>
          </button>
        ))}
      </div>
      <p className="hidden text-xs text-muted-foreground md:block">Same markup, same mock server.</p>
    </div>
  );
}

interface CompareSizesProps {
  builds: readonly CompareFrameBuild[];
  /** The build on show, whose bars stay at full strength. */
  current: CompareLibrary;
  sizes: AppSizes;
  elementId: (part: string) => string;
}

/** The measured bytes of both builds per slice, as bars on a shared scale per slice. */
function CompareSizes({ builds, current, sizes, elementId }: CompareSizesProps) {
  const [compression, setCompression] = useState<Compression>("gzip");
  const [ours, theirs] = builds;
  if (!ours || !theirs) return null;
  const rows = sizeRows(sizes, compression);

  return (
    <section aria-labelledby={elementId("sizes-heading")} className="border-t bg-background">
      <div className="flex h-11 items-stretch gap-2 border-b pr-2 pl-3">
        <h3 id={elementId("sizes-heading")} className="flex shrink-0 items-center gap-2 text-[13px] font-medium">
          Bundle size
          <span className="hidden font-normal text-muted-foreground sm:inline">JavaScript, minified</span>
        </h3>
        <DemoTabs
          label="Compression"
          className="ms-auto"
          tabs={COMPRESSIONS.map((value) => ({
            value,
            label: COMPRESSION_LABELS[value],
            panel: elementId("sizes"),
          }))}
          value={compression}
          onChange={(value) => setCompression(COMPRESSIONS.find((candidate) => candidate === value) ?? "gzip")}
          tabId={(value) => elementId(`size-${value}`)}
        />
      </div>
      <div role="tabpanel" id={elementId("sizes")} aria-labelledby={elementId(`size-${compression}`)}>
        <ul className="divide-y">
          {rows.map((row, index) => (
            <SizeRowView key={row.build} row={row} builds={[ours, theirs]} current={current} primary={index === 0} />
          ))}
        </ul>
      </div>
    </section>
  );
}

interface SizeRowViewProps {
  row: SizeRow;
  builds: readonly [CompareFrameBuild, CompareFrameBuild];
  current: CompareLibrary;
  /** The first slice, Forms + app, is the comparison that matters most. */
  primary: boolean;
}

function SizeRowView({ row, builds, current, primary }: SizeRowViewProps) {
  const largest = Math.max(row.lunarhue, row.tanstack, 1);
  return (
    <li data-size-build={row.build} className={cn("px-3 py-3 sm:px-4", primary && "bg-sidebar py-4")}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className={cn("font-medium", primary ? "text-sm" : "text-[13px]")}>{BUILD_LABELS[row.build]}</span>
        <DeltaBadge delta={row.delta} ours={builds[0].title} />
      </div>
      <div className="grid gap-2">
        {builds.map((build) => (
          <SizeBar
            key={build.library}
            build={build}
            bytes={row[build.library]}
            share={row[build.library] / largest}
            dimmed={build.library !== current}
            primary={primary}
          />
        ))}
      </div>
    </li>
  );
}

interface SizeBarProps {
  build: CompareFrameBuild;
  bytes: number;
  /** This build's bytes over the larger of the two, 0 to 1. */
  share: number;
  /** True for the build not on show. */
  dimmed: boolean;
  primary: boolean;
}

/** One build's size: its name and bytes, with a bar on mobile below and beside them from `sm`. */
function SizeBar({ build, bytes, share, dimmed, primary }: SizeBarProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[11rem_1fr_4.5rem]">
      <span className="flex min-w-0 items-center gap-2 text-[13px]">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", LIBRARY_DOT[build.library])} />
        <span className="truncate">{build.title}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{build.version}</span>
      </span>
      <span
        className={cn(
          "text-right text-[13px] tabular-nums sm:order-last",
          primary ? "font-semibold" : "font-medium",
        )}
      >
        {formatBytes(bytes)}
      </span>
      <span aria-hidden className="col-span-2 h-2 overflow-hidden rounded-full bg-muted sm:col-span-1">
        <span
          className={cn(
            "block h-full rounded-full transition-[width,opacity] duration-300 ease-out motion-reduce:transition-none",
            LIBRARY_DOT[build.library],
            dimmed && "opacity-45",
          )}
          style={{ width: `${Math.max(share * 100, 1)}%` }}
        />
      </span>
    </div>
  );
}

interface DeltaBadgeProps {
  delta: Delta;
  /** Our library's name, read out before the badge. */
  ours: string;
}

/** "−5.6 kB · 30% smaller": green when ours is smaller, amber when larger. */
function DeltaBadge({ delta, ours }: DeltaBadgeProps) {
  const tone = {
    smaller: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-400 dark:ring-emerald-400/25",
    larger: "bg-amber-500/10 text-amber-800 ring-amber-600/25 dark:text-amber-300 dark:ring-amber-400/25",
    same: "bg-muted text-muted-foreground ring-border",
  }[delta.direction];
  const text =
    delta.direction === "same"
      ? "Same size"
      : `${delta.direction === "smaller" ? "−" : "+"}${delta.bytes} · ${delta.percent} ${delta.direction}`;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap tabular-nums ring-1 ring-inset",
        tone,
      )}
    >
      <span className="sr-only">{ours} is </span>
      {text}
    </span>
  );
}
