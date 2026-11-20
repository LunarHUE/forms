import { RotateCcwIcon } from "lucide-react";
import { cn } from "cn";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";

import { CodeBlock } from "./CodeBlock";
import { CopyButton } from "./CopyButton";

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
   */
  children?: ReactNode;
}

/** The first tab. Every other tab is a file, named by its path. */
const PREVIEW = "preview";

/** Left and right arrows move between tabs, as in any tablist. */
function arrowKeys(items: readonly string[], current: string, select: (item: string) => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = items[(items.indexOf(current) + step + items.length) % items.length];
    if (next === undefined) return;
    select(next);
    const tabs = event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
    tabs[items.indexOf(next)]?.focus();
  };
}

const tabClass =
  "relative flex shrink-0 items-center px-2 text-[13px] whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:after:bg-ring after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full aria-selected:text-foreground aria-selected:after:bg-foreground";

/**
 * The demo block: a tab row with Preview and one tab per file, the live demo
 * on a stage, and the chosen file's code. The preview stays mounted while a
 * file shows, so the form keeps what the reader typed.
 */
export function DemoFrame({ id, name, files, children }: DemoFrameProps) {
  const [tab, setTab] = useState(PREVIEW);
  const file = files.find((candidate) => candidate.name === tab);
  const stage = useRef<HTMLDivElement>(null);

  const reset = () => {
    const live = stage.current?.querySelector<HTMLElement>("[data-demo-live]");
    const initial = stage.current?.querySelector<HTMLTemplateElement>("template[data-demo-initial]");
    if (!live || !initial) return;
    const islands = [...live.querySelectorAll("astro-island")];
    live.replaceChildren(initial.content.cloneNode(true));
    // Astro fires astro:unmount only after a view-transition swap, so tell
    // the old renderers here: React unmounts its root, Solid disposes.
    for (const island of islands) island.dispatchEvent(new CustomEvent("astro:unmount"));
  };

  const tabId = (part: string) => `${id}-${part}`.replace(/[^\w-]/g, "-");
  const tabs = [PREVIEW, ...files.map((candidate) => candidate.name)];

  return (
    <div
      data-slot="demo"
      data-demo={name}
      className="not-prose my-6 min-w-0 overflow-hidden rounded-lg border bg-background"
    >
      <div className="flex h-11 items-stretch gap-2 border-b bg-background pr-2 pl-1">
        <div
          role="tablist"
          aria-label="Demo"
          className="flex min-w-0 items-stretch overflow-x-auto [scrollbar-width:none]"
          onKeyDown={arrowKeys(tabs, tab, setTab)}
        >
          {tabs.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={tabId(item)}
              aria-selected={tab === item}
              aria-controls={tabId(item === PREVIEW ? "preview-panel" : "code-panel")}
              tabIndex={tab === item ? 0 : -1}
              onClick={() => setTab(item)}
              className={cn(tabClass, item === PREVIEW ? "font-medium" : "font-mono text-xs")}
            >
              {item === PREVIEW ? "Preview" : item}
            </button>
          ))}
        </div>
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
        <div ref={stage} className="demo-stage">
          {children}
        </div>
      </div>

      {file && (
        <div role="tabpanel" id={tabId("code-panel")} aria-labelledby={tabId(file.name)}>
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
