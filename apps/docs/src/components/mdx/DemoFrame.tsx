import { RotateCcwIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";

import { CodeBlock } from "./CodeBlock";
import { CopyButton } from "./CopyButton";
import { DemoTabs } from "./demo/DemoTabs";

export interface DemoFile {
  /** Path inside the demo folder, shown on its tab. */
  name: string;
  /** Source, for the copy button. */
  code: string;
  /** The source highlighted by `lib/highlight.ts`. */
  html: string;
}

export interface DemoFrameProps {
  /** Unique on the page. Prefixes the tab ids. */
  id: string;
  /** The demo's folder name, like `masks/contact`. */
  name: string;
  /** Entry file first. */
  files: DemoFile[];
  /**
   * From Demo.astro: `[data-demo-live]` holding the demo's island and
   * `template[data-demo-initial]` holding its server HTML for reset.
   * <Compare> passes its app here instead, with `onReset`.
   */
  children?: ReactNode;
  /** Replaces the island swap below. <Compare> remounts its app. */
  onReset?: () => void;
  /** A row above the tabs. */
  header?: ReactNode;
  /** A row below the preview and code. */
  footer?: ReactNode;
  /** The stage's class. Default `demo-stage`, which styles bare elements (styles/demo.css). */
  stageClassName?: string;
  /** Extra classes for the code panel, like a height cap for long files. */
  codeClassName?: string;
}

/** The first tab. Every other tab is a file, named by its path. */
const PREVIEW = "preview";

/**
 * The demo block: a tab row with Preview and one tab per file, the live demo
 * on a stage, and the chosen file's code. The preview stays mounted while a
 * file shows, so the form keeps what the reader typed.
 */
export function DemoFrame({
  id,
  name,
  files,
  children,
  onReset,
  header,
  footer,
  stageClassName = "demo-stage",
  codeClassName,
}: DemoFrameProps) {
  const [tab, setTab] = useState(PREVIEW);
  // When the files change under an open tab, as on <Compare>'s library
  // switch, a name the new list lacks falls back to the entry file. The tab
  // state keeps the name, so switching back opens it again.
  const file =
    tab === PREVIEW ? undefined : (files.find((candidate) => candidate.name === tab) ?? files[0]);
  const stage = useRef<HTMLDivElement>(null);

  const swapIsland = () => {
    const live = stage.current?.querySelector<HTMLElement>("[data-demo-live]");
    const initial = stage.current?.querySelector<HTMLTemplateElement>("template[data-demo-initial]");
    if (!live || !initial) return;
    const islands = [...live.querySelectorAll("astro-island")];
    live.replaceChildren(initial.content.cloneNode(true));
    // Astro fires astro:unmount only after a view-transition swap, so tell
    // the old renderers here: React unmounts its root, Solid disposes.
    for (const island of islands) island.dispatchEvent(new CustomEvent("astro:unmount"));
  };

  const reset = onReset ?? swapIsland;

  const tabId = (part: string) => `${id}-${part}`.replace(/[^\w-]/g, "-");

  return (
    <div
      data-slot="demo"
      data-demo={name}
      className="not-prose my-6 min-w-0 overflow-hidden rounded-lg border bg-background"
    >
      {header}
      <div className="flex h-11 items-stretch gap-2 border-b bg-background pr-2 pl-1">
        <DemoTabs
          label="Demo"
          tabs={[
            { value: PREVIEW, label: "Preview", panel: tabId("preview-panel") },
            ...files.map((candidate) => ({
              value: candidate.name,
              label: candidate.name,
              panel: tabId("code-panel"),
              mono: true,
            })),
          ]}
          value={file?.name ?? PREVIEW}
          onChange={setTab}
          tabId={tabId}
        />
        <div className="ms-auto flex shrink-0 items-center">
          {file ? (
            <CopyButton text={file.code} label={`Copy ${file.name}`} />
          ) : (
            <Hint label="Reset demo">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={reset}
              >
                <RotateCcwIcon />
              </Button>
            </Hint>
          )}
        </div>
      </div>

      <div
        role="tabpanel"
        id={tabId("preview-panel")}
        aria-labelledby={tabId(PREVIEW)}
        hidden={file !== undefined}
        className="demo-preview flex min-h-75 items-center justify-center bg-sidebar px-4 py-8 sm:px-10"
      >
        <div ref={stage} className={stageClassName}>
          {children}
        </div>
      </div>

      {file && (
        <div
          role="tabpanel"
          id={tabId("code-panel")}
          aria-labelledby={tabId(file.name)}
          data-edge-fade="y"
          className={codeClassName}
        >
          <CodeBlock
            html={file.html}
            lang={file.name.split(".").at(-1)}
            lineNumbers
            className="my-0 rounded-none border-0"
          />
        </div>
      )}
      {footer}
    </div>
  );
}
