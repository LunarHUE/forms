import { SearchIcon } from "lucide-react";

import { Hint } from "@/components/ui/tooltip";

import { DevtoolsToggle } from "./DevtoolsToggle";
import { GITHUB_URL, GitHubIcon } from "./icons";
import { ThemeMenu } from "./ThemeMenu";

const iconButton =
  "items-center justify-center rounded-md border border-transparent text-foreground outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

/**
 * The header's icon buttons: search (phones only), GitHub (desktop only),
 * devtools and theme. One island, so their tooltips hydrate together.
 */
export function HeaderActions() {
  return (
    <>
      <Hint label="Search">
        <button type="button" data-search-trigger className={`inline-flex size-8 lg:hidden ${iconButton}`}>
          <SearchIcon className="size-4.5" />
        </button>
      </Hint>
      <Hint label="GitHub">
        <a href={GITHUB_URL} className={`hidden size-8 lg:inline-flex ${iconButton}`}>
          <GitHubIcon className="size-5" />
        </a>
      </Hint>
      <DevtoolsToggle />
      <ThemeMenu />
    </>
  );
}
