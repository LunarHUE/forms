import { Tooltip } from "@base-ui/react/tooltip";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { usePackageManager } from "@/components/hooks/store";
import { PACKAGE_MANAGERS, setPackageManager } from "@/lib/store";

import { installCommand } from "./install/commands";
import { useCopy } from "./install/useCopy";
import "./install/install.css";

interface InstallProps {
  /** Package names, in the order they appear in the command. */
  packages: readonly string[];
}

/**
 * One install line: the command, package manager tabs and a copy button.
 *
 * The server HTML holds all four commands; install.css shows the one that
 * matches html[data-pm] and marks its tab, so the line is right before
 * hydration. Picking a tab updates the store, which switches every install
 * line on the page and remembers the choice.
 *
 * MDX pages use Install.astro, which works out the adapter package.
 */
export default function Install({ packages }: InstallProps) {
  const pm = usePackageManager();
  const { copied, copy } = useCopy();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-install
      className="not-prose my-4 flex flex-col overflow-hidden rounded-lg border bg-sidebar text-foreground sm:h-13 sm:flex-row sm:items-center sm:gap-3 sm:pr-2.5 sm:pl-4"
    >
      <div className="order-2 min-w-0 flex-1 overflow-x-auto px-4 py-3.5 font-mono text-sm leading-5 sm:order-1 sm:p-0">
        <code className="whitespace-pre">
          {PACKAGE_MANAGERS.map((id) => (
            <span key={id} data-pm-command={id}>
              {installCommand(id, packages)}
            </span>
          ))}
        </code>
      </div>
      <div className="order-1 flex h-10 shrink-0 items-center justify-between border-b pr-1 pl-2 sm:order-2 sm:h-auto sm:gap-3 sm:border-0 sm:p-0">
        <div role="group" aria-label="Package manager" className="flex items-center gap-0.5">
          {PACKAGE_MANAGERS.map((id) => (
            <button
              key={id}
              type="button"
              data-pm-tab={id}
              aria-pressed={id === pm}
              onClick={() => setPackageManager(id)}
              className="flex h-6 cursor-pointer items-center rounded-[4px] border border-transparent px-2 font-mono text-xs leading-4 text-muted-foreground outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {id}
            </button>
          ))}
        </div>
        <div aria-hidden className="hidden h-5 w-px shrink-0 bg-border sm:block" />
        <Tooltip.Root open={hovered || copied} onOpenChange={setHovered}>
          <Tooltip.Trigger
            delay={0}
            aria-label="Copy command"
            onClick={() => void copy(installCommand(pm, packages))}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {copied ? (
              <CheckIcon className="size-4 text-brand" strokeWidth={1.5} />
            ) : (
              <CopyIcon className="size-4" strokeWidth={1.5} />
            )}
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={8} className="z-50">
              {/* Dark in both themes, like the devtools. */}
              <Tooltip.Popup className="rounded-md bg-devtools px-2.5 py-1.5 text-xs leading-4 font-medium text-devtools-foreground shadow-sm dark:border dark:border-devtools-border">
                {copied ? "Copied" : "Copy"}
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
    </div>
  );
}
