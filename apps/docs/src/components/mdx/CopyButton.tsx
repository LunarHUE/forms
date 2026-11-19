import { CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "cn";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface CopyButtonProps {
  /** What goes on the clipboard. */
  text: string;
  /** Tooltip and accessible name before copying. Default "Copy". */
  label?: string;
  className?: string;
}

/** How long the check mark and "Copied" stay up. */
const COPIED_MS = 1500;

/**
 * Icon button that copies `text`, then shows a check and "Copied" for a
 * moment. An island of its own: hydrate it with `client:visible` and keep
 * whatever surrounds it static.
 */
export function CopyButton({ text, label = "Copy", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard (insecure origin, denied permission): leave the icon alone.
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  // Base UI closes a tooltip when its trigger is pressed. Controlling `open`
  // keeps it up long enough to say "Copied".
  return (
    <Tooltip open={hovered || copied} onOpenChange={setHovered}>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copied ? "Copied" : label}
            className={cn("text-muted-foreground hover:text-foreground", className)}
            onClick={copy}
          />
        }
      >
        {copied ? <CheckIcon className="text-brand" /> : <CopyIcon />}
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : label}</TooltipContent>
    </Tooltip>
  );
}
