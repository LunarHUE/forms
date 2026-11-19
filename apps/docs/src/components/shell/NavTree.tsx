import type { NavGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";

/*
 * The sidebar's section list. Sidebar.astro renders it without a client
 * directive, so on desktop it is plain HTML; MobileNav renders it inside the
 * drawer. `compact` is the drawer's tighter spacing.
 */
export function NavTree({
  groups,
  currentSlug,
  compact = false,
}: {
  groups: readonly NavGroup[];
  currentSlug?: string;
  compact?: boolean;
}) {
  return (
    <nav aria-label="Docs" className={cn("flex flex-col", compact ? "gap-3" : "gap-6")}>
      {groups.map((group) => (
        <section key={group.section}>
          <h2 className="px-2.5 pb-1.5 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
            {group.label}
          </h2>
          <ul className="flex flex-col">
            {group.items.map((item) => {
              const current = item.slug === currentSlug;
              return (
                <li key={item.slug}>
                  <a
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex items-center rounded-md px-2.5 text-sm outline-none",
                      "focus-visible:ring-2 focus-visible:ring-ring",
                      compact ? "h-7" : "h-8",
                      current ? "bg-brand-tint text-brand" : "text-foreground hover:bg-foreground/5",
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
