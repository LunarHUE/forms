import { cn } from "cn";
import { useEffect, useState, type MouseEvent } from "react";

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
 * The slugs of every section that is in the window, in page order. A section
 * runs from its heading to the next row's heading, the last one to the end of
 * the article. The window's top is the line a jump lands on (the heading's
 * `scroll-margin-top`), so the header and the phone bar don't count.
 */
export function useActiveSections(items: readonly TocItem[]): readonly string[] {
  const [active, setActive] = useState<readonly string[]>(items[0] ? [items[0].slug] : []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let frame = 0;

    const update = () => {
      frame = 0;
      const targets = items.map((item) => byId(item.slug));
      const first = targets.find((target) => target !== null);
      if (!first) return;
      const line = parseFloat(getComputedStyle(first).scrollMarginTop) || 0;
      const end = first.closest("article")?.getBoundingClientRect().bottom ?? document.body.scrollHeight;
      const tops = targets.map((target) => target?.getBoundingClientRect().top);
      const next: string[] = [];
      items.forEach((item, index) => {
        const top = tops[index];
        if (top === undefined) return;
        const bottom = tops.slice(index + 1).find((value) => value !== undefined) ?? end;
        if (bottom > line + 8 && top < innerHeight) next.push(item.slug);
      });
      setActive((previous) =>
        previous.length === next.length && previous.every((slug, index) => slug === next[index]) ? previous : next,
      );
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };

    addEventListener("scroll", schedule, { passive: true, signal });
    addEventListener("resize", schedule, { signal });
    // Demos and code panels change height after hydrating.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    signal.addEventListener("abort", () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    });

    update();
    return () => controller.abort();
  }, [items]);

  return active;
}

interface TocListProps {
  items: readonly TocItem[];
  /** The rows to mark, from `useActiveSections`. */
  active: readonly string[];
  onClick?: (event: MouseEvent<HTMLAnchorElement>, slug: string) => void;
  className?: string;
  /** Classes for each link, on top of the shared ones. */
  linkClassName?: string;
}

/**
 * The rows: a 1px rule down the left. Every row whose section is in the
 * window turns the accent and draws a 2px bar over the rule, and the bars of
 * neighbouring rows join into one range. The first marked row gets
 * aria-current. Third-level headings sit one step in.
 */
export function TocList({ items, active, onClick, className, linkClassName }: TocListProps) {
  return (
    <ul className={cn("flex flex-col border-l", className)}>
      {items.map((item) => {
        const marked = active.includes(item.slug);
        return (
          <li key={item.slug} className="relative flex">
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 -left-px w-0.5 bg-brand opacity-0 transition-opacity duration-150 motion-reduce:transition-none",
                marked && "opacity-100",
              )}
            />
            <a
              href={`#${item.slug}`}
              aria-current={item.slug === active[0] ? "location" : undefined}
              data-active={marked ? "" : undefined}
              onClick={(event) => onClick?.(event, item.slug)}
              className={cn(
                "flex-1 pl-3.5 text-muted-foreground transition-colors duration-150 [overflow-wrap:anywhere] motion-reduce:transition-none",
                "outline-none hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
                item.depth >= 3 && "pl-6",
                marked && "text-foreground",
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
