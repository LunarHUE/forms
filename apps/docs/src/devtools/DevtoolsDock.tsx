import { Dialog } from "@base-ui/react/dialog";
import { CheckIcon, ChevronDownIcon, SquareEqualIcon, SquareMousePointerIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { registry, type FormEntry } from "./registry";

/**
 * A placeholder for the forms devtools, on every page. It already does the
 * page side: lists the forms the demos registered, selects one from its tag
 * or with pick mode, and docks in any corner. The inspector itself isn't
 * built yet, so the panel says so.
 *
 * Desktop: a dark bar in a corner, with the panel above (or below) it. Phone:
 * a round button that opens a bottom sheet.
 */

export const CORNER_KEY = "forms:devtools-corner";
const CORNERS = ["bottom-left", "bottom-right", "top-left", "top-right"] as const;
type Corner = (typeof CORNERS)[number];
const DEFAULT_CORNER: Corner = "bottom-left";
const CORNER_LABELS: Record<Corner, string> = {
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
  "top-left": "Top left",
  "top-right": "Top right",
};
const isCorner = (value: unknown): value is Corner => (CORNERS as readonly unknown[]).includes(value);

type Tab = "fields" | "bundle";
const TABS: { id: Tab; label: string }[] = [
  { id: "fields", label: "Fields" },
  { id: "bundle", label: "Bundle" },
];

/** Below this the shell is the phone layout, and so is the dock. */
const PHONE = "(max-width: 1023px)";

function readCorner(): Corner {
  try {
    const stored = localStorage.getItem(CORNER_KEY);
    return isCorner(stored) ? stored : DEFAULT_CORNER;
  } catch {
    return DEFAULT_CORNER;
  }
}

function useCorner() {
  const [corner, setCorner] = useState<Corner>(readCorner);
  const move = (next: Corner) => {
    setCorner(next);
    try {
      localStorage.setItem(CORNER_KEY, next);
    } catch {
      // Storage can be off; the dock still moves for this page.
    }
  };
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === CORNER_KEY) setCorner(readCorner());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return [corner, move] as const;
}

const useRegistry = () => useSyncExternalStore(registry.subscribe, registry.getState, registry.getState);

/**
 * Pick mode: the next click on a form outline selects that form. Any other
 * click, or Escape, ends it.
 */
function usePickMode(active: boolean, done: () => void) {
  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    root.dataset.devtoolsPicking = "";
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-devtools-dock]")) return;
      const outline = target?.closest("[data-form-demo]");
      const entry = registry.list().find((form) => form.element && form.element === outline);
      if (entry) {
        event.preventDefault();
        event.stopPropagation();
        registry.select(entry.id);
      }
      done();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") done();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      delete root.dataset.devtoolsPicking;
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, done]);
}

const iconButton =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-devtools-muted outline-none hover:bg-white/8 hover:text-devtools-foreground focus-visible:ring-2 focus-visible:ring-ring/60 aria-pressed:bg-white/10 aria-pressed:text-devtools-foreground aria-expanded:bg-white/8 [&_svg]:size-4";

const menuContent = "w-56 bg-devtools font-mono text-xs text-devtools-foreground ring-devtools-border";
const menuItem =
  "text-xs text-devtools-foreground focus:bg-white/10 focus:text-devtools-foreground not-data-[variant=destructive]:focus:**:text-devtools-foreground";

/** The selected form, or a menu to choose one. */
function FormChip({ forms, selected, side }: { forms: readonly FormEntry[]; selected?: FormEntry; side: "top" | "bottom" }) {
  const shown = selected ?? forms[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={selected ? `Form ${selected.name}. Choose a form` : "Choose a form"}
        className="inline-flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-devtools-foreground outline-none hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-ring/60 aria-expanded:bg-white/8"
      >
        <span
          aria-hidden
          className={cn("size-2.5 shrink-0 rounded-[2px] border", selected ? "border-brand" : "border-devtools-muted")}
        />
        <span className={cn("truncate", !shown && "text-devtools-muted")}>{shown?.name ?? "No forms"}</span>
        <ChevronDownIcon aria-hidden className="size-3.5 text-devtools-muted lg:hidden" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} sideOffset={8} className={menuContent}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-devtools-muted">Forms on this page</DropdownMenuLabel>
          {forms.length === 0 && (
            <DropdownMenuItem disabled className={menuItem}>
              None yet
            </DropdownMenuItem>
          )}
          {forms.map((form) => (
            <DropdownMenuItem key={form.id} className={menuItem} onClick={() => registry.select(form.id)}>
              <span
                aria-hidden
                className={cn(
                  "size-2.5 rounded-[2px] border",
                  form.id === selected?.id ? "border-brand" : "border-devtools-muted",
                )}
              />
              {form.name}
              {form.id === selected?.id && <CheckIcon className="ms-auto text-brand" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Tabs({ tab, onTab }: { tab: Tab | null; onTab: (tab: Tab) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={tab === item.id}
          onClick={() => onTab(item.id)}
          className="h-7 rounded-md px-2.5 font-sans text-[13px] text-devtools-muted outline-none hover:text-devtools-foreground focus-visible:ring-2 focus-visible:ring-ring/60 aria-pressed:bg-white/10 aria-pressed:text-devtools-foreground"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** What the panel says until the inspector exists. */
function PanelBody({ tab, selected }: { tab: Tab; selected?: FormEntry }) {
  return (
    <div className="flex flex-col gap-2 leading-5">
      <p className="text-devtools-foreground">
        {selected ? (
          <>
            <span className="text-devtools-muted">form</span> &quot;{selected.name}&quot;
          </>
        ) : (
          <span className="text-devtools-muted">No form selected. Click a form&apos;s tag or use pick mode.</span>
        )}
      </p>
      <p className="font-sans text-[13px] text-devtools-muted">
        The forms devtools aren&apos;t available yet. {tab === "fields" ? "Fields" : "Bundle"} will show{" "}
        {tab === "fields" ? "each field's value, display text and what wrote it" : "the plugins in the form's bundle"}.
      </p>
    </div>
  );
}

export function DevtoolsDock() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const { forms, selected: selectedId } = useRegistry();
  const selected = forms.find((form) => form.id === selectedId);
  const [corner, move] = useCorner();
  const [tab, setTab] = useState<Tab | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const stopPicking = useCallback(() => setPicking(false), []);
  usePickMode(picking, stopPicking);

  // Selecting a form, from its tag or the menu, opens the panel on it.
  useEffect(() => {
    let previous = registry.getState().selected;
    return registry.subscribe(({ selected: next }) => {
      if (next !== null && next !== previous) {
        setTab((current) => current ?? "fields");
        if (window.matchMedia(PHONE).matches) setSheetOpen(true);
      }
      previous = next;
    });
  }, []);

  // The page's corner is only known in the browser, so the dock renders after hydration.
  if (!mounted) return null;

  const top = corner.startsWith("top");
  const right = corner.endsWith("right");
  const toggleTab = (next: Tab) => setTab((current) => (current === next ? null : next));

  return (
    <div data-devtools-dock className="font-mono text-xs">
      <div
        data-corner={corner}
        className={cn(
          "fixed z-40 hidden max-w-[calc(100vw-48px)] gap-2 lg:flex",
          top ? "top-20 flex-col-reverse" : "bottom-6 flex-col",
          right ? "right-6 items-end" : "left-6 items-start",
        )}
      >
        {tab && (
          <section
            aria-label={`Devtools ${tab}`}
            className="w-[363px] max-w-full rounded-lg border border-devtools-border bg-devtools p-4 text-devtools-foreground shadow-lg"
          >
            <PanelBody tab={tab} selected={selected} />
          </section>
        )}
        <div
          role="toolbar"
          aria-label="Forms devtools"
          className="flex h-10 items-center gap-1 rounded-lg border border-devtools-border bg-devtools px-1.5 text-devtools-foreground shadow-lg"
        >
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Devtools menu" className={iconButton}>
              <SquareEqualIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent side={top ? "bottom" : "top"} sideOffset={8} className={menuContent}>
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-devtools-muted">Dock position</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={corner} onValueChange={(value) => isCorner(value) && move(value)}>
                  {CORNERS.map((option) => (
                    <DropdownMenuRadioItem key={option} value={option} className={menuItem}>
                      {CORNER_LABELS[option]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <FormChip forms={forms} selected={selected} side={top ? "bottom" : "top"} />
          {selected && (
            <button
              type="button"
              aria-label={`Clear selection ${selected.name}`}
              className={cn(iconButton, "-ml-1 size-6 [&_svg]:size-3")}
              onClick={() => {
                registry.select(null);
                setTab(null);
              }}
            >
              <XIcon />
            </button>
          )}
          <div aria-hidden className="mx-1 h-4 w-px bg-devtools-border" />
          <button
            type="button"
            aria-label="Pick a form on the page"
            aria-pressed={picking}
            className={iconButton}
            onClick={() => setPicking((current) => !current)}
          >
            <SquareMousePointerIcon />
          </button>
          <Tabs tab={tab} onTab={toggleTab} />
        </div>
      </div>

      <button
        type="button"
        aria-label="Open the forms devtools"
        className="fixed right-4 bottom-4 z-40 inline-flex size-12 items-center justify-center rounded-full bg-devtools text-devtools-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60 lg:hidden [&_svg]:size-5"
        onClick={() => setSheetOpen(true)}
      >
        <SquareEqualIcon aria-hidden />
      </button>
      {/*
        The sheet from components/ui/sheet dims the page behind it, and the
        selected outline has to stay in view, so this is a non-modal dialog
        with the sheet's look.
      */}
      <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen} modal={false}>
        <Dialog.Portal>
          <Dialog.Popup
            data-devtools-dock
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-xl border-t border-devtools-border bg-devtools font-mono text-xs text-devtools-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:translate-y-10 data-ending-style:opacity-0 data-starting-style:translate-y-10 data-starting-style:opacity-0 lg:hidden"
          >
              <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-full bg-devtools-border" />
              <Dialog.Title className="sr-only">Forms devtools</Dialog.Title>
              <div className="flex h-12 items-center gap-1 border-b border-devtools-border px-3">
                <span className="inline-flex size-7 items-center justify-center text-devtools-muted [&_svg]:size-4">
                  <SquareEqualIcon aria-hidden />
                </span>
                <FormChip forms={forms} selected={selected} side="top" />
                <div className="ms-auto flex items-center gap-1">
                  <Tabs tab={tab ?? "fields"} onTab={setTab} />
                  <button
                    type="button"
                    aria-label="Close the devtools"
                    className={iconButton}
                    onClick={() => setSheetOpen(false)}
                  >
                    <XIcon />
                  </button>
                </div>
              </div>
              <Dialog.Description render={<div />} className="min-h-32 p-4">
                <PanelBody tab={tab ?? "fields"} selected={selected} />
              </Dialog.Description>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
