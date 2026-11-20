import type { DemoSource } from "./markdown";

/*
 * The comparison apps in examples/compare: each app built once with our
 * library and once with TanStack Form. This module only shapes data, so the
 * unit tests can feed it anything. lib/compare-sources.ts reads the real
 * files and sizes.json.
 */

/** The libraries in the order the docs show them. Ours first. */
export const COMPARE_LIBRARIES = ["lunarhue", "tanstack"] as const;
export type CompareLibrary = (typeof COMPARE_LIBRARIES)[number];

/** The package whose version labels each library. */
export const LIBRARY_PACKAGES: Record<CompareLibrary, string> = {
  lunarhue: "@lunarhue/forms-react",
  tanstack: "@tanstack/react-form",
};

/** The builds scripts/size-compare.ts measures, in the order the docs show them. */
export const SIZE_BUILDS = ["forms", "total", "app"] as const;
export type SizeBuild = (typeof SIZE_BUILDS)[number];

export const BUILD_LABELS: Record<SizeBuild, string> = {
  forms: "Forms + app",
  total: "Total",
  app: "App only",
};

export const COMPRESSIONS = ["gzip", "brotli", "min"] as const;
export type Compression = (typeof COMPRESSIONS)[number];

export const COMPRESSION_LABELS: Record<Compression, string> = {
  gzip: "gzip",
  brotli: "brotli",
  min: "minified",
};

/** Bytes of one build. */
export type Size = Readonly<Record<Compression, number>>;

/** The shape of examples/compare/sizes.json. */
export interface SizesFile {
  readonly versions: Readonly<Record<string, string>>;
  readonly builds: Readonly<Record<SizeBuild, string>>;
  readonly apps: Readonly<Record<string, Readonly<Record<CompareLibrary, Readonly<Record<SizeBuild, Size>>>>>>;
}

/** One app's numbers, as the docs pass them to the block. */
export type AppSizes = Readonly<Record<CompareLibrary, Readonly<Record<SizeBuild, Size>>>>;

/** One library's build of an app. */
export interface CompareBuild {
  readonly library: CompareLibrary;
  /** "@lunarhue/forms" or "TanStack Form". */
  readonly title: string;
  /** From sizes.json, the version that was measured. */
  readonly version: string;
  /** The app's own files for this library, App.tsx first. */
  readonly files: readonly DemoSource[];
}

/** `1234` as `1.2 kB`. Kilobytes are 1000 bytes, as bundlers print them. */
export function formatBytes(bytes: number): string {
  if (Math.abs(bytes) < 1000) return `${bytes} B`;
  return `${(bytes / 1000).toFixed(1)} kB`;
}

export interface SizeRow {
  readonly build: SizeBuild;
  readonly lunarhue: number;
  readonly tanstack: number;
  /** "5.6 kB smaller (30%)", or "larger" when ours is bigger, or "the same". */
  readonly difference: string;
  /** True when ours is smaller. */
  readonly smaller: boolean;
}

/** Our size against TanStack's, read as ours: "5.6 kB smaller (30%)". */
export function difference(ours: number, theirs: number): string {
  const delta = theirs - ours;
  if (delta === 0) return "the same";
  const percent = (Math.abs(delta) / theirs) * 100;
  const shown = percent < 1 ? percent.toFixed(1) : Math.round(percent).toString();
  return `${formatBytes(Math.abs(delta))} ${delta > 0 ? "smaller" : "larger"} (${shown}%)`;
}

/** One row per build, in `SIZE_BUILDS` order. */
export function sizeRows(sizes: AppSizes, compression: Compression): SizeRow[] {
  return SIZE_BUILDS.map((build) => {
    const lunarhue = sizes.lunarhue[build][compression];
    const tanstack = sizes.tanstack[build][compression];
    return { build, lunarhue, tanstack, difference: difference(lunarhue, tanstack), smaller: lunarhue < tanstack };
  });
}

function fence(lang: string, code: string, title: string): string {
  const ticks = "`".repeat(Math.max(3, ...[...code.matchAll(/`{3,}/g)].map((match) => match[0].length + 1)));
  return `${ticks}${lang} title="${title}"\n${code.replace(/\n$/, "")}\n${ticks}`;
}

/**
 * The block as Markdown, for the `.md` routes: the sizes as a table, then
 * each library's files in fences titled `lunarhue/App.tsx` and so on.
 */
export function compareMarkdown(builds: readonly CompareBuild[], sizes: AppSizes, compression: Compression = "gzip"): string {
  const [ours, theirs] = builds;
  if (ours === undefined || theirs === undefined) throw new Error("A comparison needs both builds.");
  const label = (build: CompareBuild) => `${build.title} ${build.version}`;
  const table = [
    `| Build (${COMPRESSION_LABELS[compression]}) | ${ours.title} is | ${label(ours)} | ${label(theirs)} |`,
    "| --- | --- | --- | --- |",
    ...sizeRows(sizes, compression).map(
      (row) =>
        `| ${BUILD_LABELS[row.build]} | ${row.difference} | ${formatBytes(row.lunarhue)} | ${formatBytes(row.tanstack)} |`,
    ),
  ].join("\n");
  const code = builds.flatMap((build) =>
    build.files.map((file) => fence(file.name.split(".").at(-1) ?? "", file.code, `${build.library}/${file.name}`)),
  );
  return [table, ...code].join("\n\n");
}
