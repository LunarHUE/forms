import { RotateCcwIcon, SquareEqualIcon } from "lucide-react";
import { cn } from "cn";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { registry } from "@/devtools/registry";

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
  /** Unique on the page; the devtools registry key. */
  id: string;
  /** The demo's folder name, like `masks/contact`. */
  name: string;
  /** The form's name on the outline tag. */
  form: string;
  /** Entry file first. */
  files: DemoFile[];
  /**
   * From Demo.astro: `[data-demo-live]` holding the demo's island and
   * `template[data-demo-initial]` holding its server HTML for reset.
   */
  children?: ReactNode;
}

type Mode = "preview" | "code";
const MODES: { id: Mode; label: string }[] = [
  { id: "preview", label: "Preview" },
  { id: "code", label: "Code" },
];

/** Left and right arrows move between tabs, as in any tablist. */
function arrowKeys<T>(items: readonly T[], current: T, select: (item: T) => void) {
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

/**
 * The demo block: a toolbar with Preview and Code tabs, the live demo on a
 * stage inside the devtools outline, and the demo's files. The preview stays
 * mounted while the code shows, so the form keeps what the reader typed.
 */
export function DemoFrame({ id, name, form, files, children }: DemoFrameProps) {
  const [mode, setMode] = useState<Mode>("preview");
  const [fileName, setFileName] = useState(files[0]?.name ?? "");
  const file = files.find((candidate) => candidate.name === fileName) ?? files[0];
  const outline = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const selected = useSyncExternalStore(
    registry.subscribe,
    () => registry.getState().selected === id,
    () => false,
  );

  useEffect(() => {
    registry.register({ id, name: form, element: outline.current });
    return () => registry.unregister(id);
  }, [id, form]);

  const reset = () => {
    const live = stage.current?.querySelector<HTMLElement>("[data-demo-live]");
    const initial = stage.current?.querySelector<HTMLTemplateElement>("template[data-demo-initial]");
    if (!live || !initial) return;
    const islands = [...live.querySelectorAll("astro-island")];
    live.replaceChildren(initial.content.cloneNode(true));
    // Astro fires astro:unmount only after a view-transition swap, so tell
    // the old renderers here: React unmounts its root, Solid disposes.
    for (const island of islands) island.dispatchEvent(new CustomEvent("astro:unmount"));
    // A new form instance now sits in the outline; the devtools pick it up.
    registry.register({ id, name: form, element: outline.current });
  };

  const tabId = (part: string) => `${id}-${part}`.replace(/[^\w-]/g, "-");
  const fileNames = files.map((candidate) => candidate.name);

  return (
    <div
      data-slot="demo"
      data-demo={name}
      className="not-prose my-6 min-w-0 overflow-hidden rounded-lg border bg-background"
    >
      <div className="flex h-11 items-center gap-3 border-b bg-background pr-2 pl-1.5">
        <div
          role="tablist"
          aria-label="View"
          className="flex h-8 shrink-0 items-center rounded-md border bg-muted p-[3px]"
          onKeyDown={arrowKeys(
            MODES.map((item) => item.id),
            mode,
            setMode,
          )}
        >
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={tabId(item.id)}
              aria-selected={mode === item.id}
              aria-controls={tabId(`${item.id}-panel`)}
              tabIndex={mode === item.id ? 0 : -1}
              onClick={() => setMode(item.id)}
              className={cn(
                "h-full rounded-[5px] border border-transparent px-2.5 text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                mode === item.id && "border-border bg-background text-foreground shadow-xs",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {mode === "code" && (
          <>
            <div aria-hidden className="h-5 w-px shrink-0 bg-border" />
            <div
              role="tablist"
              aria-label="Files"
              className="-mb-px flex h-11 min-w-0 items-stretch gap-4 overflow-x-auto [scrollbar-width:none]"
              onKeyDown={arrowKeys(fileNames, file?.name ?? "", setFileName)}
            >
              {files.map((candidate) => (
                <button
                  key={candidate.name}
                  type="button"
                  role="tab"
                  aria-selected={candidate === file}
                  aria-controls={tabId("code-panel")}
                  tabIndex={candidate === file ? 0 : -1}
                  onClick={() => setFileName(candidate.name)}
                  className={cn(
                    "shrink-0 border-b-2 border-transparent font-mono text-xs whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline",
                    candidate === file && "border-foreground text-foreground",
                  )}
                >
                  {candidate.name}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="ms-auto flex shrink-0 items-center">
          {mode === "code" && file ? (
            <CopyButton text={file.code} label={`Copy ${file.name}`} />
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Reset demo"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={reset}
                  />
                }
              >
                <RotateCcwIcon />
              </TooltipTrigger>
              <TooltipContent>Reset</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div
        role="tabpanel"
        id={tabId("preview-panel")}
        aria-labelledby={tabId("preview")}
        hidden={mode !== "preview"}
        className="demo-preview flex min-h-75 items-center justify-center bg-sidebar px-4 py-8 sm:px-10"
      >
        <div
          ref={outline}
          data-form-demo={name}
          data-form-name={form}
          data-form-id={id}
          data-selected={selected ? "" : undefined}
        >
          <button
            type="button"
            data-form-tag
            aria-pressed={selected}
            aria-label={`Inspect form ${form} in the devtools`}
            onClick={() => registry.select(id)}
          >
            <SquareEqualIcon aria-hidden className="size-3" />
            {form}
          </button>
          <div ref={stage} className="demo-stage">
            {children}
          </div>
        </div>
      </div>

      {mode === "code" && file && (
        <div role="tabpanel" id={tabId("code-panel")} aria-labelledby={tabId("code")}>
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
