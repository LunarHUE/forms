import type { Framework } from "@/lib/frameworks";
import type { NavGroup } from "@/lib/nav";

import type { PickerItem } from "./picker";

/** What one framework's sidebar needs: the picker state and the nav groups. */
export interface SidebarData {
  framework: Framework;
  version: string;
  items: PickerItem[];
  groups: readonly NavGroup[];
}
