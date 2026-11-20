import { cn } from "cn";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type RefObject } from "react";

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

/** Where the range marker sits, in px from the top of the list. */
interface Range {
  top: number;
  height: number;
}

/**
 * Measures the span from the first marked row to the last. Null until the
 * list has been measured, and when nothing is marked.
 */
function useRange(list: RefObject<HTMLUListElement | null>, items: readonly TocItem[], active: readonly string[]) {
  const [range, setRange] = useState<Range | null>(null);

  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return undefined;
    const measure = () => {
      const rows = [...element.querySelectorAll<HTMLElement>(":scope > li")];
      const marked = rows.filter((_, index) => active.includes(items[index]?.slug ?? ""));
      const first = marked[0];
      const last = marked.at(-1);
      setRange((previous) => {
        if (!first || !last) return null;
        const next = { top: first.offsetTop, height: last.offsetTop + last.offsetHeight - first.offsetTop };
        return previous?.top === next.top && previous.height === next.height ? previous : next;
      });
    };
    measure();
    // Rows rewrap when the rail or the drawer changes width.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [list, items, active]);

  return range;
}

/**
 * The rows: a 1px rule down the left. Every row whose section is in the
 * window turns the accent, and a 2px bar over the rule spans those rows. The
 * bar slides and stretches as the range changes. The first marked row gets
 * aria-current. Third-level headings sit one step in.
 *
 * The server HTML can't measure, so until hydration each marked row draws its
 * own piece of the bar.
 */
export function TocList({ items, active, onClick, className, linkClassName }: TocListProps) {
  const list = useRef<HTMLUListElement>(null);
  const range = useRange(list, items, active);
  // The bar lands without sliding the first time, then slides from there on.
  const [sliding, setSliding] = useState(false);
  useEffect(() => {
    if (!range || sliding) return undefined;
    const frame = requestAnimationFrame(() => setSliding(true));
    return () => cancelAnimationFrame(frame);
  }, [range, sliding]);

  return (
    <ul ref={list} className={cn("relative flex flex-col border-l", className)}>
      {range && (
        <span
          aria-hidden
          className={cn(
            "absolute top-0 -left-px w-0.5 bg-brand motion-reduce:transition-none",
            sliding && "transition-[transform,height] duration-200 ease-out",
          )}
          style={{ transform: `translateY(${range.top}px)`, height: range.height }}
        />
      )}
      {items.map((item) => {
        const marked = active.includes(item.slug);
        return (
          <li key={item.slug} className="relative flex">
            {!range && marked && <span aria-hidden className="absolute inset-y-0 -left-px w-0.5 bg-brand" />}
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
