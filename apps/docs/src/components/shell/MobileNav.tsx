import { Dialog } from "@base-ui/react/dialog";
import { ExternalLinkIcon, MenuIcon, XIcon } from "lucide-react";

import { useLastFramework } from "@/components/hooks/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Hint } from "@/components/ui/tooltip";
import type { Framework } from "@/lib/frameworks";

import { FrameworkPicker } from "./FrameworkPicker";
import { GITHUB_URL, GitHubIcon } from "./icons";
import { NavTree } from "./NavTree";
import type { SidebarData } from "./sidebar";

/*
 * The phone drawer: the header's menu button and a sheet from the left with
 * the picker, the nav and a GitHub link. Shell.astro mounts it with
 * client:media, so desktop never loads it.
 *
 * `sidebars` has one entry on a framework page. The framework-free pages pass
 * one per framework and the drawer shows the last-used one, like the desktop
 * sidebar does with CSS.
 */
interface MobileNavProps {
  sidebars: SidebarData[];
  currentSlug?: string;
}

export function MobileNav({ sidebars, currentSlug }: MobileNavProps) {
  const last = useLastFramework();
  const sidebar = pick(sidebars, last);
  if (!sidebar) return null;
  return (
    <Sheet>
      <Hint label="Open navigation">
        <SheetTrigger render={<Button variant="ghost" size="icon" />}>
          <MenuIcon className="size-5" />
        </SheetTrigger>
      </Hint>
      {/* shadcn's SheetContent has a light, blurred scrim; the mock's is darker and flat. */}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col border-r bg-sidebar text-sidebar-foreground shadow-lg outline-none transition-transform duration-200 ease-out data-ending-style:-translate-x-full data-starting-style:-translate-x-full">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center gap-2 border-b p-3">
            <div className="min-w-0 flex-1">
              <FrameworkPicker items={sidebar.items} framework={sidebar.framework} version={sidebar.version} />
            </div>
            <Hint label="Close navigation">
              <SheetClose render={<Button variant="ghost" size="icon" />}>
                <XIcon className="size-5" />
              </SheetClose>
            </Hint>
          </div>
          <div className="scroll-fade-y min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-4">
            <NavTree groups={sidebar.groups} currentSlug={currentSlug} compact />
          </div>
          <a
            href={GITHUB_URL}
            className="flex items-center gap-2.5 border-t px-5.5 py-4 text-sm outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <GitHubIcon className="size-4.5" />
            GitHub
            <ExternalLinkIcon className="ml-auto size-4 text-muted-foreground" />
          </a>
        </Dialog.Popup>
      </Dialog.Portal>
    </Sheet>
  );
}

function pick(sidebars: SidebarData[], last: Framework | null): SidebarData | undefined {
  if (sidebars.length === 1) return sidebars[0];
  return sidebars.find((sidebar) => sidebar.framework === last) ?? sidebars[0];
}
