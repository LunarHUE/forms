import { cn } from "cn";
import type { KeyboardEvent, ReactNode } from "react";

export interface DemoTab {
  readonly value: string;
  readonly label: ReactNode;
  /** The id of the panel the tab shows. */
  readonly panel: string;
  /** File names read in the code font. */
  readonly mono?: boolean;
}

export interface DemoTabsProps {
  /** The tablist's accessible name. */
  label: string;
  tabs: readonly DemoTab[];
  value: string;
  onChange: (value: string) => void;
  /** The tab's element id, which its panel's `aria-labelledby` points at. */
  tabId: (value: string) => string;
  className?: string;
}

const tabClass =
  "relative flex shrink-0 items-center px-2 text-[13px] whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground focus-visible:after:bg-ring after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full aria-selected:text-foreground aria-selected:after:bg-foreground";

/**
 * The tab row of the demo blocks: underlined tabs that scroll sideways when
 * they overflow. Left and right arrows move between tabs, as in any tablist.
 */
export function DemoTabs({ label, tabs, value, onChange, tabId, className }: DemoTabsProps) {
  const values = tabs.map((tab) => tab.value);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = (values.indexOf(value) + step + values.length) % values.length;
    const next = values[index];
    if (next === undefined) return;
    onChange(next);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      data-edge-fade="x"
      className={cn("flex min-w-0 items-stretch overflow-x-auto [scrollbar-width:none]", className)}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          id={tabId(tab.value)}
          aria-selected={value === tab.value}
          aria-controls={tab.panel}
          tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          className={cn(tabClass, tab.mono ? "font-mono text-xs" : "font-medium")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
