import { SquareEqualIcon } from "lucide-react";

import { useDevtoolsEnabled } from "@/components/hooks/store";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { setDevtools } from "@/lib/store";

/**
 * The header's devtools switch. The dock can turn the devtools off, and this
 * is where they come back. Its look follows html[data-devtools], so it is
 * right before hydration too. The panel renders nothing at 640px wide and
 * below, phoneQuery in the devtools' panel/app.tsx, so the switch hides at
 * the same width.
 */
export function DevtoolsToggle() {
  const enabled = useDevtoolsEnabled();
  return (
    <Hint label={enabled ? "Turn off the forms devtools" : "Turn on the forms devtools"}>
      <Button
        variant="outline"
        size="icon"
        aria-label="Forms devtools"
        aria-pressed={enabled}
        className="text-brand in-data-[devtools=off]:text-muted-foreground [@media(max-width:640px)]:hidden"
        onClick={() => setDevtools(!enabled)}
      >
        <SquareEqualIcon />
      </Button>
    </Hint>
  );
}
