import { cn } from "cn";
import { useEffect, useRef, useState, type MouseEvent } from "react";

/** One "On this page" row. `slug` is the id of the element it jumps to. */
export interface TocItem {
  readonly depth: number;
  readonly slug: string;
  readonly text: string;
}

/** The id on the page title. The first TOC row links to it. */
export const TOP_ID = "top";

const byId = (slug: string) => document.getElementById(slug);

/**
 * The slug of the section being read: the last target whose top has passed
 * the line where a jump to it would land (its `scroll-margin-top`). At the
 * foot of the page the last row wins, so a short closing section can be
 * marked at all.
 *
 * A click on a row marks that row and holds it until the reader scrolls by
 * hand (wheel, touch or a key). Without the hold, a jump to a section near
 * the end would land at the foot of the page and mark the last row instead.
 */
export function useActiveSection(items: readonly TocItem[]) {
  const [active, setActive] = useState<string | undefined>(items[0]?.slug);
  const held = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let frame = 0;

    const update = () => {
      frame = 0;
      if (held.current) return;
      const targets = items.map((item) => byId(item.slug));
      const bottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
      let current: string | undefined = items[0]?.slug;
      if (bottom && scrollY > 0) {
        current = items.at(-1)?.slug;
      } else {
        targets.forEach((target, index) => {
          if (!target) return;
          const line = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
          if (target.getBoundingClientRect().top <= line + 8) current = items[index]?.slug;
        });
      }
      setActive(current);
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };
    const release = () => {
      held.current = false;
      schedule();
    };
    const fromHash = () => {
      const slug = decodeURIComponent(location.hash.slice(1));
      if (!items.some((item) => item.slug === slug)) return;
      held.current = true;
      setActive(slug);
    };

    addEventListener("scroll", schedule, { passive: true, signal });
    addEventListener("resize", schedule, { signal });
    addEventListener("hashchange", fromHash, { signal });
    for (const type of ["wheel", "touchmove", "keydown"] as const) {
      addEventListener(type, release, { passive: true, signal });
    }
    // Demos and code panels change height after hydrating.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    signal.addEventListener("abort", () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    });

    if (location.hash) fromHash();
    update();
    return () => controller.abort();
  }, [items]);

  /**
   * For a row's click: mark it and hold the mark. `hashchange` would do the
   * same, but it doesn't fire when the hash is already that row's. Returns
   * false for a click that opens the link elsewhere (modifier keys).
   */
  const select = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    held.current = true;
    setActive(slug);
    return true;
  };
  return { active, select };
}

interface TocListProps {
  items: readonly TocItem[];
  active: string | undefined;
  onSelect?: (event: MouseEvent<HTMLAnchorElement>, slug: string) => void;
  className?: string;
  /** Classes for each link, on top of the shared ones. */
  linkClassName?: string;
}

/**
 * The rows: a 1px rule down the left, the current row in the accent with a
 * 2px bar over the rule. Third-level headings sit one step in.
 */
export function TocList({ items, active, onSelect, className, linkClassName }: TocListProps) {
  return (
    <ul className={cn("flex flex-col border-l", className)}>
      {items.map((item) => {
        const current = item.slug === active;
        return (
          <li key={item.slug} className="flex">
            <a
              href={`#${item.slug}`}
              aria-current={current ? "location" : undefined}
              onClick={(event) => onSelect?.(event, item.slug)}
              className={cn(
                "relative -ml-px flex-1 border-l-2 border-transparent pl-3.5 text-muted-foreground [overflow-wrap:anywhere]",
                "outline-none hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
                item.depth >= 3 && "pl-6",
                current && "border-brand text-brand hover:text-brand",
                linkClassName,
              )}
            >
              {item.text}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
