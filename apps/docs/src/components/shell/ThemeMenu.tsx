import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { useTheme } from "@/components/hooks/store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setTheme, THEMES, type Theme } from "@/lib/store";

const options: Record<Theme, { label: string; Icon: typeof SunIcon }> = {
  light: { label: "Light", Icon: SunIcon },
  dark: { label: "Dark", Icon: MoonIcon },
  system: { label: "System", Icon: MonitorIcon },
};

const isTheme = (value: unknown): value is Theme => (THEMES as readonly unknown[]).includes(value);

const itemClass =
  "h-8 gap-2 data-checked:bg-brand-tint data-checked:focus:bg-brand-tint [&_[data-slot=dropdown-menu-radio-item-indicator]_*]:text-brand!";

/** The header's theme button. The icon follows html.dark, so it is right before hydration too. */
export function ThemeMenu() {
  const theme = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Theme" />}>
        <SunIcon className="dark:hidden" />
        <MoonIcon className="hidden dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            if (isTheme(value)) setTheme(value);
          }}
        >
          {THEMES.map((value) => {
            const { label, Icon } = options[value];
            return (
              <DropdownMenuRadioItem key={value} value={value} className={itemClass}>
                <Icon /> {label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
