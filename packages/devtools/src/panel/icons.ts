import { h, type JSX } from "preact";

// Lucide's icons (ISC), as path data on a 24 by 24 grid.
const paths = {
  panel: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M7 10h10", "M7 14h10"],
  pick: [
    "M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z",
    "M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6",
  ],
  chevron: ["m6 9 6 6 6-6"],
  close: ["M18 6 6 18", "m6 6 12 12"],
  check: ["M20 6 9 17l-5-5"],
  off: [
    "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
    "M14.084 14.158a3 3 0 0 1-4.242-4.242",
    "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
    "m2 2 20 20",
  ],
  inspect: ["M12 2v4", "M12 18v4", "M2 12h4", "M18 12h4", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
} as const;

export type IconName = keyof typeof paths;

/** An icon, hidden from assistive technology: the button around it carries the label. */
export const icon = (name: IconName, className?: string): JSX.Element =>
  h(
    "svg",
    { viewBox: "0 0 24 24", "aria-hidden": "true", class: className },
    paths[name].map((d) => h("path", { d })),
  );
