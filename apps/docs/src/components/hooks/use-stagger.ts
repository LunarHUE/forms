import { useCallback } from "react";

import { MENU_ROWS, watchStagger } from "@/lib/motion";

/**
 * A ref callback that staggers the rows of the element it lands on, as it
 * mounts and as rows are added. Popups mount on open, so they stagger on open.
 */
export function useStagger(selector: string = MENU_ROWS) {
  return useCallback((element: HTMLElement | null) => (element ? watchStagger(element, selector) : undefined), [selector]);
}
