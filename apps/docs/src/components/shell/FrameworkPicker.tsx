import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { navigate } from "astro:transitions/client";
import { ChevronsUpDownIcon } from "lucide-react";

import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from "@/components/ui/combobox";
import { isFramework } from "@/lib/frameworks";
import { setFramework } from "@/lib/store";
import { cn } from "@/lib/utils";

import { FrameworkIcon } from "./icons";
import type { PickerItem } from "./picker";

export type { PickerItem } from "./picker";

/*
 * The framework and version picker at the top of the sidebar: one combobox
 * with a framework group and a version group. Both groups always have their
 * current item selected (it is a `multiple` combobox for that reason), so
 * picking another item means "go there". Build `items` with `pickerItems()`.
 */

const labelClass = "px-2 pt-2 pb-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase";
const itemClass =
  "h-8 gap-2 rounded-md pl-2 text-sm data-[selected]:bg-brand-tint data-[selected]:data-highlighted:bg-brand-tint [&>span:last-child_*]:text-brand!";

/** Follows the item's link, or switches the last-used framework when it has none. */
function go(item: PickerItem): void {
  if (item.href) void navigate(item.href);
  else if (item.group === "framework" && isFramework(item.value)) setFramework(item.value);
}

interface FrameworkPickerProps {
  items: PickerItem[];
  framework: string;
  version: string;
  /** What picking an item does. Default: follow its link, see `go`. */
  onNavigate?: (item: PickerItem) => void;
}

export function FrameworkPicker({ items, framework, version, onNavigate = go }: FrameworkPickerProps) {
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
        const picked = next.find((item) => !selected.includes(item));
        if (picked) onNavigate(picked);
      }}
    >
      <ComboboxPrimitive.Trigger
        aria-label={`${current?.label ?? framework} ${version}, change framework or version`}
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
        {/* The items are children, not Base UI's `items`, so the list counts as empty and loses its padding. */}
        <ComboboxList className="data-empty:p-1">
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
