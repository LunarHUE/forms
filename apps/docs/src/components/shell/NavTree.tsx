import { ChevronRightIcon } from "lucide-react";

import type { NavGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";

/*
 * The sidebar's section list. Sidebar.astro renders it without a client
 * directive, so on desktop it is plain HTML; MobileNav renders it inside the
 * drawer. `compact` is the drawer's tighter spacing.
 *
 * Each group is a <details>, so it folds without any script. A rule runs down
 * the left of its items and the current page marks it in the accent. Shell
 * remembers which groups were folded (`data-nav-group`) and moves the
 * current-page mark after a client-side navigation. rail.ts slides one bar
 * (`data-nav-marker`) along the rail in place of the links' own borders.
 */
interface NavTreeProps {
  groups: readonly NavGroup[];
  currentSlug?: string;
  /** The drawer's tighter spacing. */
  compact?: boolean;
}

export function NavTree({ groups, currentSlug, compact = false }: NavTreeProps) {
  return (
    <nav aria-label="Docs" data-nav className={cn("relative flex flex-col", compact ? "gap-3" : "gap-5")}>
      <span
        aria-hidden
        data-nav-marker
        className="pointer-events-none absolute top-0 left-0 w-0.5 bg-brand opacity-0 data-hover:bg-foreground/30"
      />
      {groups.map((group) => (
        <details key={group.section} open data-nav-group={group.section} className="group/nav">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center gap-1 rounded-md px-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase select-none",
              "outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
              compact ? "h-7" : "h-6",
            )}
          >
            <ChevronRightIcon
              aria-hidden
              className="size-3.5 shrink-0 transition-transform group-open/nav:rotate-90 motion-reduce:transition-none"
              strokeWidth={1.75}
            />
            {group.label}
          </summary>
          <ul className="mt-1 ml-[11px] flex flex-col border-l">
            {group.items.map((item) => {
              const current = item.slug === currentSlug;
              return (
                <li key={item.slug} className="flex">
                  <a
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    // Styled from aria-current, so Shell can move the mark on a
                    // sidebar the client router kept from the last page.
                    className={cn(
                      "-ml-px flex flex-1 items-center border-l-2 border-transparent pl-3.5 text-sm text-foreground/80 outline-none",
                      "hover:not-aria-[current=page]:border-foreground/30 hover:not-aria-[current=page]:text-foreground",
                      "aria-[current=page]:border-brand aria-[current=page]:font-medium aria-[current=page]:text-brand",
                      "focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      compact ? "h-8" : "h-7.5",
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </nav>
  );
}
