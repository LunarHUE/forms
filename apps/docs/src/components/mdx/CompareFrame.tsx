import { ExternalLinkIcon, RotateCcwIcon } from "lucide-react";
import { cn } from "cn";
import { useEffect, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import {
  BUILD_LABELS,
  COMPRESSION_LABELS,
  COMPRESSIONS,
  formatBytes,
  sizeRows,
  type AppSizes,
  type CompareLibrary,
  type Compression,
} from "@/lib/compare";

import { CodeBlock } from "./CodeBlock";
import { CopyButton } from "./CopyButton";
import type { DemoFile } from "./DemoFrame";
import { DemoTabs } from "./demo/DemoTabs";

export interface CompareFrameBuild {
  readonly library: CompareLibrary;
  /** "@lunarhue/forms" or "TanStack Form". */
  readonly title: string;
  readonly version: string;
  /** The page that runs this build, for the iframe. */
  readonly src: string;
  /** App.tsx first. */
  readonly files: readonly DemoFile[];
}

export interface CompareFrameProps {
  /** Unique on the page. Prefixes the element ids. */
  id: string;
  /** The app's name, like "Sign-up", for the iframe's title. */
  title: string;
  /** Ours first. */
  builds: readonly CompareFrameBuild[];
  /** From examples/compare/sizes.json. */
  sizes: AppSizes;
}

/** Taller apps scroll inside the frame, so a modal dialog still opens in view. */
const MAX_FRAME_HEIGHT = 720;

/**
 * The comparison block: one live app with a switch for the build that runs
 * it, the measured sizes of both builds, then each library's code with a tab
 * per file. Both builds behave the same, so one preview is enough.
 */
export function CompareFrame({ id, title, builds, sizes }: CompareFrameProps) {
  const elementId = (part: string) => `${id}-${part}`.replace(/[^\w-]/g, "-");
  return (
    <div data-slot="compare" className="not-prose my-6 min-w-0 overflow-hidden rounded-lg border bg-background">
      <ComparePreview title={title} builds={builds} elementId={elementId} />
      <CompareSizes builds={builds} sizes={sizes} elementId={elementId} />
      {builds.map((build) => (
        <CompareCode key={build.library} build={build} elementId={elementId} />
      ))}
    </div>
  );
}

interface ComparePreviewProps {
  title: string;
  builds: readonly CompareFrameBuild[];
  elementId: (part: string) => string;
}

/**
 * The live app. A build's iframe loads the first time it is picked and then
 * stays, hidden, so switching back keeps what the reader typed.
 */
function ComparePreview({ title, builds, elementId }: ComparePreviewProps) {
  const first = builds[0]?.library ?? "lunarhue";
  const [current, setCurrent] = useState<CompareLibrary>(first);
  const [opened, setOpened] = useState<readonly CompareLibrary[]>([first]);
  // Bumped by Reload. A new key mounts a fresh iframe, which loads the app again.
  const [loads, setLoads] = useState<Partial<Record<CompareLibrary, number>>>({});
  const active = builds.find((build) => build.library === current);

  function pick(library: string) {
    const build = builds.find((candidate) => candidate.library === library);
    if (!build) return;
    setCurrent(build.library);
    setOpened((list) => (list.includes(build.library) ? list : [...list, build.library]));
  }

  function reload() {
    setLoads((counts) => ({ ...counts, [current]: (counts[current] ?? 0) + 1 }));
  }

  return (
    <div>
      <div className="flex h-11 items-stretch gap-2 border-b pr-2 pl-1">
        <DemoTabs
          label="Build"
          tabs={builds.map((build) => ({
            value: build.library,
            label: <BuildLabel build={build} />,
            panel: elementId("preview"),
          }))}
          value={current}
          onChange={pick}
          tabId={(library) => elementId(`build-${library}`)}
        />
        <div className="ms-auto flex shrink-0 items-center">
          {active && (
            <Hint label="Open in a new tab">
              <a
                href={active.src}
                target="_blank"
                rel="noopener"
                aria-label="Open in a new tab"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "text-muted-foreground hover:text-foreground",
                )}
              >
                <ExternalLinkIcon />
              </a>
            </Hint>
          )}
          <Hint label="Reload app">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={reload}
            >
              <RotateCcwIcon />
            </Button>
          </Hint>
        </div>
      </div>
      <div
        role="tabpanel"
        id={elementId("preview")}
        aria-labelledby={elementId(`build-${current}`)}
        className="border-b bg-sidebar"
      >
        {builds
          .filter((build) => opened.includes(build.library))
          .map((build) => (
            <AppFrame
              key={`${build.library}-${loads[build.library] ?? 0}`}
              src={build.src}
              title={`${title}, built with ${build.title}`}
              hidden={build.library !== current}
            />
          ))}
      </div>
    </div>
  );
}

interface BuildLabelProps {
  build: CompareFrameBuild;
}

function BuildLabel({ build }: BuildLabelProps) {
  return (
    <span>
      {build.title} <span className="font-normal text-muted-foreground">{build.version}</span>
    </span>
  );
}

interface AppFrameProps {
  src: string;
  title: string;
  hidden: boolean;
}

/** An iframe as tall as the app inside it, up to MAX_FRAME_HEIGHT. */
function AppFrame({ src, title, hidden }: AppFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    let observer: ResizeObserver | undefined;
    // Same origin, so the docs can read the app's height. A reload replaces
    // the document, so watch again after every load.
    const watch = () => {
      observer?.disconnect();
      const root = frame.contentDocument?.documentElement;
      if (!root) return;
      observer = new ResizeObserver(() => setHeight(Math.ceil(root.getBoundingClientRect().height)));
      observer.observe(root);
    };
    // The frame may have loaded before this island hydrated.
    if (frame.contentDocument?.readyState === "complete") watch();
    frame.addEventListener("load", watch);
    return () => {
      frame.removeEventListener("load", watch);
      observer?.disconnect();
    };
  }, []);

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      hidden={hidden}
      loading="lazy"
      className="block w-full"
      style={{ height: height === undefined ? 480 : Math.min(height, MAX_FRAME_HEIGHT) }}
    />
  );
}

interface CompareSizesProps {
  builds: readonly CompareFrameBuild[];
  sizes: AppSizes;
  elementId: (part: string) => string;
}

/** The measured bytes of both builds, the difference first. */
function CompareSizes({ builds, sizes, elementId }: CompareSizesProps) {
  const [compression, setCompression] = useState<Compression>("gzip");
  const [ours, theirs] = builds;
  if (!ours || !theirs) return null;
  const rows = sizeRows(sizes, compression);

  return (
    <div className="border-b">
      <div className="flex h-11 items-stretch gap-2 border-b pr-2 pl-3">
        <h3 className="flex items-center text-[13px] font-medium">Bundle size</h3>
        <DemoTabs
          label="Compression"
          className="ms-auto"
          tabs={COMPRESSIONS.map((value) => ({
            value,
            label: COMPRESSION_LABELS[value],
            panel: elementId("sizes"),
          }))}
          value={compression}
          onChange={(value) => setCompression(value as Compression)}
          tabId={(value) => elementId(`size-${value}`)}
        />
      </div>
      <div
        role="tabpanel"
        id={elementId("sizes")}
        aria-labelledby={elementId(`size-${compression}`)}
        className="overflow-x-auto"
      >
        <table className="w-full text-[13px] tabular-nums">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Build
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {ours.title} is
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                <BuildLabel build={ours} />
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                <BuildLabel build={theirs} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.build} className="border-t">
                <th scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {BUILD_LABELS[row.build]}
                </th>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{row.difference}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatBytes(row.lunarhue)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatBytes(row.tanstack)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface CompareCodeProps {
  build: CompareFrameBuild;
  elementId: (part: string) => string;
}

/** One library's files, a tab each, like the demo block's code tabs. */
function CompareCode({ build, elementId }: CompareCodeProps) {
  const [name, setName] = useState(build.files[0]?.name ?? "");
  const file = build.files.find((candidate) => candidate.name === name);
  const panel = elementId(`${build.library}-code`);
  const tabId = (value: string) => elementId(`${build.library}-${value}`);

  return (
    <div className="border-b last:border-b-0">
      <div className="flex h-11 items-stretch gap-2 border-b pr-2 pl-3">
        <span className="flex shrink-0 items-center text-[13px] font-medium">
          <BuildLabel build={build} />
        </span>
        <DemoTabs
          label={`${build.title} files`}
          tabs={build.files.map((candidate) => ({
            value: candidate.name,
            label: candidate.name,
            panel,
            mono: true,
          }))}
          value={name}
          onChange={setName}
          tabId={tabId}
        />
        {file && (
          <div className="ms-auto flex shrink-0 items-center">
            <CopyButton text={file.code} label={`Copy ${build.library}/${file.name}`} />
          </div>
        )}
      </div>
      {file && (
        <div role="tabpanel" id={panel} aria-labelledby={tabId(file.name)} className="max-h-144 overflow-y-auto">
          <CodeBlock
            html={file.html}
            lang={file.name.split(".").at(-1)}
            lineNumbers
            className="my-0 rounded-none border-0"
          />
        </div>
      )}
    </div>
  );
}
