import { TocList, useActiveSection, type TocItem } from "./toc-list";

interface TocProps {
  items: readonly TocItem[];
}

/**
 * The right-rail "On this page" from 1280px. The server HTML marks the first
 * row; hydrated with `client:media="(min-width: 1280px)"`, it follows the
 * scroll.
 */
export default function Toc({ items }: TocProps) {
  const { active, select } = useActiveSection(items);
  return (
    <nav aria-labelledby="toc-label">
      <p id="toc-label" className="mb-3 font-mono text-[11px] leading-4 tracking-[0.08em] text-muted-foreground uppercase">
        On this page
      </p>
      <TocList items={items} active={active} onSelect={select} linkClassName="py-1 text-[13px] leading-5" />
    </nav>
  );
}
