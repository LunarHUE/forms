import { ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { TocList, useActiveSection, type TocItem } from "./toc-list";

interface MobileTocProps {
  items: readonly TocItem[];
  /** The breadcrumb, server-rendered. It sits left of the toggle. */
  children?: ReactNode;
}

/**
 * The bar under the header below 1280px: breadcrumb on the left, an "On
 * this page" toggle on the right. Open, the list sits in the bar and pushes
 * the page down. Hydrated with `client:media="(max-width: 1279px)"`.
 */
export default function MobileToc({ items, children }: MobileTocProps) {
  const [open, setOpen] = useState(false);
  const { active, select } = useActiveSection(items);
  const trigger = useRef<HTMLButtonElement>(null);

  // Escape closes the list. Focus inside it goes back to the toggle.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const inside = trigger.current?.closest("[data-slot=collapsible]")?.contains(document.activeElement);
      setOpen(false);
      if (inside) trigger.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Close first, then jump, so the jump lands where the target is once the
  // list has collapsed. Base UI removes the panel a frame after it closes.
  const jump = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (!select(event, slug)) return;
    event.preventDefault();
    setOpen(false);
    history.pushState(null, "", `#${slug}`);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.getElementById(slug)?.scrollIntoView()),
    );
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex h-11 items-center justify-between gap-3">
        <div className="min-w-0">{children}</div>
        <CollapsibleTrigger ref={trigger} className="-mr-2.5 flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-[panel-open]:bg-muted">
          On this page
          <ChevronDownIcon
            aria-hidden
            className="size-4 text-muted-foreground transition-transform in-data-[panel-open]:rotate-180 motion-reduce:transition-none"
            strokeWidth={1.5}
          />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <nav aria-label="On this page" className="pt-3 pb-4">
          <TocList items={items} active={active} onSelect={jump} linkClassName="py-2 text-[15px] leading-5" />
        </nav>
      </CollapsibleContent>
    </Collapsible>
  );
}
