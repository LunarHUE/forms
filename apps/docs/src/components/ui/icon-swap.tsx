import { cn } from "cn";
import type { ReactNode } from "react";

export interface IconSwapProps {
  /** Shows `to` instead of `from`. */
  swapped: boolean;
  from: ReactNode;
  to: ReactNode;
  className?: string;
}

const layer =
  "col-start-1 row-start-1 flex transition-[opacity,scale,filter] duration-150 ease-out data-hidden:opacity-0 motion-safe:data-hidden:scale-60 motion-safe:data-hidden:blur-xs";

/**
 * Two icons in one spot, cross-faded with a little scale and blur so the
 * change reads as one icon changing state (copy to check). With reduced
 * motion only the fade is left.
 */
export function IconSwap({ swapped, from, to, className }: IconSwapProps) {
  return (
    <span data-slot="icon-swap" className={cn("grid place-items-center", className)}>
      <span data-hidden={swapped || undefined} className={layer}>
        {from}
      </span>
      <span data-hidden={!swapped || undefined} className={layer}>
        {to}
      </span>
    </span>
  );
}
