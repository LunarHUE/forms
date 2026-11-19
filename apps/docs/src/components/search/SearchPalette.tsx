import { Command as CommandPrimitive } from "cmdk";
import { cn } from "cn";
import { CornerDownRightIcon, FileTextIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { frameworkLabel, type Framework } from "@/lib/frameworks";

import { currentFramework, loadPagefind, search, type PageHit, type SearchHit } from "./pagefind";

declare global {
  interface Window {
    /**
     * Shared with Search.astro's inline script. `pending`: an open request
     * not handled yet. `open`: the palette is open. `typed`: keys typed since
     * the request, for the input to take, or null when nothing is waiting.
     */
    formsSearch?: { pending: boolean; open: boolean; typed: string | null };
  }
}

type Status = "loading" | "ready" | "unavailable";

const kbd = "inline-flex h-5 items-center rounded-sm border bg-background px-1 font-mono text-[11px] text-muted-foreground";
const itemClass = cn(
  "items-start gap-2.5 px-2.5 py-2 data-selected:bg-brand-tint",
  // CommandItem appends a check icon for checkable items; results have none.
  "[&>svg:last-child]:hidden",
  "[&_mark]:bg-transparent [&_mark]:font-medium [&_mark]:text-foreground",
);

function Hit({ hit, section, onSelect }: { hit: SearchHit; section?: boolean; onSelect: (url: string) => void }) {
  const Icon = section ? CornerDownRightIcon : FileTextIcon;
  return (
    <CommandItem value={hit.url} onSelect={onSelect} className={cn(itemClass, section && "pl-6")}>
      <Icon className="mt-0.5 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate leading-5 font-medium">{hit.title}</div>
        {hit.excerpt && (
          <div
            className="line-clamp-2 text-[13px] leading-5 text-muted-foreground"
            // Pagefind escapes the page text and adds only <mark>.
            dangerouslySetInnerHTML={{ __html: hit.excerpt }}
          />
        )}
      </div>
    </CommandItem>
  );
}

/**
 * The search palette: a dialog holding a cmdk list of Pagefind results for
 * the current framework, grouped by page with matching sections under each.
 * Search.astro opens it. Pagefind's script loads on first open; in
 * `astro dev` there is no index, so the palette says so instead.
 */
export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [framework, setFramework] = useState<Framework>("react");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [hits, setHits] = useState<PageHit[]>([]);
  const [searched, setSearched] = useState("");
  const [active, setActive] = useState("");
  const latest = useRef(0);
  const isOpen = useRef(false);
  useEffect(() => {
    isOpen.current = open;
    const state = window.formsSearch;
    if (!state) return;
    state.open = open;
    if (!open) state.typed = null;
  }, [open]);

  useEffect(() => {
    const state = (window.formsSearch ??= { pending: false, open: false, typed: null });
    const handle = () => {
      if (!state.pending) return;
      state.pending = false;
      // A second Ctrl K closes the palette.
      if (isOpen.current) {
        setOpen(false);
        return;
      }
      setFramework(currentFramework());
      setQuery("");
      setOpen(true);
    };
    // A request made before hydration.
    handle();
    document.addEventListener("forms-search:open", handle);
    return () => document.removeEventListener("forms-search:open", handle);
  }, []);

  useEffect(() => {
    if (!open || status === "ready" || import.meta.env.DEV) return;
    loadPagefind().then(
      () => setStatus("ready"),
      () => setStatus("unavailable"),
    );
  }, [open, status]);

  useEffect(() => {
    const id = ++latest.current;
    const text = query.trim();
    if (status !== "ready" || !text) return;
    loadPagefind()
      .then((pagefind) => search(pagefind, text, framework))
      .then(
        (found) => {
          if (!found || id !== latest.current) return;
          setHits(found);
          setSearched(text);
          setActive(found[0]?.url ?? "");
        },
        () => {
          if (id === latest.current) setStatus("unavailable");
        },
      );
  }, [query, framework, status]);

  // Keys typed between Ctrl K and the input getting focus go into the query.
  const takeTyped = () => {
    const state = window.formsSearch;
    const typed = state?.typed;
    if (!state || typed == null) return;
    state.typed = null;
    if (typed) setQuery((current) => current + typed);
  };

  const go = (url: string) => {
    // A link to a heading on the current page only scrolls, so close first.
    setOpen(false);
    window.location.assign(url);
  };

  // The last results stay up while the next search runs, and go once the box is empty.
  const shown = status === "ready" && query.trim() ? hits : [];
  const label = frameworkLabel(framework);
  let message: string | undefined;
  if (import.meta.env.DEV) message = "Search works in the built site. Run bun run build, then bun run preview.";
  else if (status === "unavailable") message = "Search is unavailable. Reload the page to try again.";
  else if (status === "loading") message = "Loading the search index…";
  else if (!query.trim()) message = `Search the ${label} docs.`;
  else if (searched && shown.length === 0) message = `No results for "${searched}".`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "top-2 flex max-h-[calc(100dvh-1rem)] translate-y-0 flex-col gap-0 overflow-hidden rounded-lg p-0 ring-0",
          "border shadow-lg sm:top-[12vh] sm:max-h-[min(34rem,76vh)] sm:max-w-xl",
        )}
      >
        <DialogTitle className="sr-only">Search the docs</DialogTitle>
        <DialogDescription className="sr-only">Results come from the {label} docs.</DialogDescription>
        <Command
          label={`Search the ${label} docs`}
          shouldFilter={false}
          loop
          value={active}
          onValueChange={setActive}
          className="min-h-0 flex-1 rounded-none! p-0"
        >
          <div className="flex h-12 shrink-0 items-center gap-2.5 border-b px-3.5">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              data-search-input
              autoFocus
              onFocus={takeTyped}
              value={query}
              onValueChange={setQuery}
              placeholder={`Search ${label} docs`}
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
            <span className={cn(kbd, "shrink-0 px-1.5")}>{label}</span>
            <DialogClose className={cn(kbd, "cursor-pointer hover:text-foreground")} aria-label="Close search">
              <span className="sm:hidden">Close</span>
              <span className="hidden sm:inline">Esc</span>
            </DialogClose>
          </div>
          <CommandList className={cn("max-h-none min-h-0 flex-1 overscroll-contain", shown.length > 0 && "p-1")}>
            {shown.map((page) => (
              <CommandGroup key={page.url} heading={page.path}>
                <Hit hit={page} onSelect={go} />
                {page.sections.map((section) => (
                  <Hit key={section.url} hit={section} section onSelect={go} />
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          {message && <p className="px-4 py-8 text-center text-sm text-muted-foreground">{message}</p>}
          <div
            aria-hidden="true"
            className="hidden h-10 shrink-0 items-center gap-4 border-t px-3.5 text-xs text-muted-foreground sm:flex"
          >
            <span className="flex items-center gap-1.5">
              <kbd className={kbd}>↑</kbd>
              <kbd className={kbd}>↓</kbd>
              move
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className={kbd}>↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className={kbd}>Esc</kbd>
              close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
