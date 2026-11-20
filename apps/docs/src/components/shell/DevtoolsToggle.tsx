import { SquareEqualIcon } from "lucide-react";

import { useDevtoolsEnabled } from "@/components/hooks/store";
import { Button } from "@/components/ui/button";
import { setDevtools } from "@/lib/store";

/**
 * The header's devtools switch. The dock can turn the devtools off, and this
 * is where they come back. Its look follows html[data-devtools], so it is
 * right before hydration too.
 */
export function DevtoolsToggle() {
  const enabled = useDevtoolsEnabled();
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Forms devtools"
      aria-pressed={enabled}
      title={enabled ? "Turn off the forms devtools" : "Turn on the forms devtools"}
      className="text-brand in-data-[devtools=off]:text-muted-foreground"
      onClick={() => setDevtools(!enabled)}
    >
      <SquareEqualIcon />
    </Button>
  );
}
