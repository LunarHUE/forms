import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { AtomIcon, ChevronsUpDownIcon, LayersIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

// Sketch of the sidebar picker from the mock. Item 1.3 builds the real one from
// `alternates` and lib/versions.ts; until then the hrefs are placeholders.

export interface PickerItem {
  group: "framework" | "version";
  value: string;
  label: string;
  href: string;
  disabled?: boolean;
  hint?: string;
}

function VueIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M2 4h4l6 10 6-10h4L12 20z" />
      <path d="M7 4l5 8 5-8" />
    </svg>
  );
}

const icons: Record<string, (props: { className?: string }) => ReactNode> = {
  react: AtomIcon,
  solid: LayersIcon,
  vue: VueIcon,
};

function FrameworkIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name];
  return Icon ? <Icon className={className} /> : null;
}

const labelClass = "px-2 pt-2 pb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase";
const itemClass =
  "h-8 gap-2 rounded-md pl-2 text-sm data-[selected]:bg-brand-tint data-[selected]:data-highlighted:bg-brand-tint [&>span:last-child_*]:text-brand!";

export function FrameworkPicker({
  items,
  framework,
  version,
  onNavigate = (href) => window.location.assign(href),
}: {
  items: PickerItem[];
  framework: string;
  version: string;
  onNavigate?: (href: string) => void;
}) {
  const selected = items.filter(
    (item) =>
      (item.group === "framework" && item.value === framework) ||
      (item.group === "version" && item.value === version),
  );
  const current = selected.find((item) => item.group === "framework");
  const frameworks = items.filter((item) => item.group === "framework");
  const versions = items.filter((item) => item.group === "version");

  return (
    <Combobox<PickerItem, true>
      multiple
      value={selected}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.group === b.group && a.value === b.value}
      onValueChange={(next) => {
        // Both groups stay selected; picking another item means "go there".
        const picked = next.find((item) => !selected.includes(item));
        if (picked) onNavigate(picked.href);
      }}
    >
      <ComboboxPrimitive.Trigger
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium outline-none",
          "hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 data-[popup-open]:border-ring",
        )}
      >
        <FrameworkIcon name={framework} className="size-4" />
        <span>{current?.label}</span>
        <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">{version}</span>
        <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
      </ComboboxPrimitive.Trigger>
      <ComboboxContent className="min-w-(--anchor-width)">
        <ComboboxList>
          <ComboboxGroup>
            <ComboboxLabel className={labelClass}>Framework</ComboboxLabel>
            {frameworks.map((item) => (
              <ComboboxItem key={item.value} value={item} disabled={item.disabled} className={itemClass}>
                <FrameworkIcon name={item.value} className="text-muted-foreground" />
                {item.label}
                {item.hint && <span className="ml-auto text-xs text-muted-foreground">{item.hint}</span>}
              </ComboboxItem>
            ))}
          </ComboboxGroup>
          <ComboboxSeparator />
          <ComboboxGroup>
            <ComboboxLabel className={labelClass}>Version</ComboboxLabel>
            {versions.map((item) => (
              <ComboboxItem key={item.value} value={item} className={cn(itemClass, "font-mono text-[13px]")}>
                {item.label}
                {item.hint && (
                  <span className="ml-auto font-sans text-xs text-muted-foreground">{item.hint}</span>
                )}
              </ComboboxItem>
            ))}
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
