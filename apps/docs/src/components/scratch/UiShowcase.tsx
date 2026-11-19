import { CheckIcon, ChevronRightIcon, CopyIcon, MenuIcon, MonitorIcon, MoonIcon, SearchIcon, SunIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { FrameworkPicker, type PickerItem } from "./FrameworkPicker";

const pickerItems: PickerItem[] = [
  { group: "framework", value: "react", label: "React", href: "#react" },
  { group: "framework", value: "solid", label: "Solid", href: "#solid" },
  { group: "framework", value: "vue", label: "Vue", href: "#vue", disabled: true, hint: "Soon" },
  { group: "version", value: "0.1.1", label: "0.1.1", href: "#0.1.1", hint: "latest" },
  { group: "version", value: "0.1.0", label: "0.1.0", href: "#0.1.0" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-[11px] tracking-wider text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

const radioItemClass =
  "h-8 gap-2 data-checked:bg-brand-tint data-checked:focus:bg-brand-tint [&_[data-slot=dropdown-menu-radio-item-indicator]_*]:text-brand!";

function ThemeMenu() {
  const [theme, setTheme] = useState("system");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Theme" />}>
        <SunIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" className={radioItemClass}>
            <SunIcon /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className={radioItemClass}>
            <MoonIcon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className={radioItemClass}>
            <MonitorIcon /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CopyButton() {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Base UI closes a tooltip when its trigger is pressed; keep it open to say "Copied".
  return (
    <Tooltip open={hovered || copied} onOpenChange={setHovered}>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy"
            onClick={() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          />
        }
      >
        {copied ? <CheckIcon className="text-brand" /> : <CopyIcon />}
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
    </Tooltip>
  );
}

export default function UiShowcase({ framework = "react" }: { framework?: string }) {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-8">
        <Section title="Framework picker (combobox)">
          <div className="w-62 rounded-lg bg-sidebar p-4">
            <FrameworkPicker
              items={pickerItems}
              framework={framework}
              version="0.1.1"
              onNavigate={(href) => console.info("navigate", href)}
            />
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Save</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="link">Link</Button>
            <Button variant="outline" size="icon" aria-label="Search">
              <SearchIcon />
            </Button>
          </div>
        </Section>

        <Section title="Header controls (button, kbd, dropdown menu, tooltip)">
          <div className="flex items-center gap-2">
            <Button variant="outline" className="w-60 justify-start gap-2 font-normal text-muted-foreground">
              <SearchIcon />
              Search
              <KbdGroup className="ml-auto">
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </Button>
            <ThemeMenu />
            <CopyButton />
          </div>
        </Section>

        <Section title="Breadcrumb">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#plugins">Plugins</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Masks</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="preview" className="rounded-lg border">
            <div className="border-b p-2">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="code">Code</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="preview" className="bg-muted p-8 text-sm">
              Preview stage
            </TabsContent>
            <TabsContent value="code" className="bg-muted p-8 font-mono text-[13px]">
              mask(&#123; phone: &#123; clean: digits, display: formatPhone &#125; &#125;);
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="Collapsible">
          <Collapsible defaultOpen className="flex flex-col gap-1">
            <CollapsibleTrigger className="group flex items-center gap-1 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
              <ChevronRightIcon className="size-3.5 transition-transform group-data-[panel-open]:rotate-90" />
              Plugins
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col">
              <a href="#history" className="rounded-md px-2.5 py-1.5 text-sm hover:bg-accent">
                History
              </a>
              <a href="#masks" className="rounded-md bg-sidebar-accent px-2.5 py-1.5 text-sm text-sidebar-accent-foreground">
                Masks
              </a>
              <a href="#rules" className="rounded-md px-2.5 py-1.5 text-sm hover:bg-accent">
                Rules
              </a>
            </CollapsibleContent>
          </Collapsible>
        </Section>

        <Section title="Separator">
          <div className="flex h-5 items-center gap-3 text-sm">
            <span>bun</span>
            <Separator orientation="vertical" />
            <span>npm</span>
          </div>
          <Separator />
        </Section>

        <Section title="Sheet">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" className="w-fit" />}>
              <MenuIcon /> Open menu
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>forms</SheetTitle>
                <SheetDescription>Phone navigation drawer.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </Section>

        <Section title="Tokens">
          <div className="grid grid-cols-4 gap-2 text-[11px]">
            {[
              ["background", "bg-background"],
              ["sidebar", "bg-sidebar"],
              ["foreground", "bg-foreground"],
              ["muted-fg", "bg-muted-foreground"],
              ["border", "bg-border"],
              ["brand", "bg-brand"],
              ["brand-tint", "bg-brand-tint"],
              ["destructive", "bg-destructive"],
              ["devtools", "bg-devtools"],
              ["devtools-border", "bg-devtools-border"],
              ["devtools-fg", "bg-devtools-foreground"],
              ["devtools-muted", "bg-devtools-muted"],
            ].map(([name, cls]) => (
              <div key={name} className="flex flex-col gap-1">
                <div className={`h-8 rounded-md border ${cls}`} />
                <span className="font-mono text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
          <p className="text-base">
            Inter for prose. <code className="font-mono text-[0.875em]">Geist Mono for code</code>.
          </p>
        </Section>
      </div>
    </TooltipProvider>
  );
}
