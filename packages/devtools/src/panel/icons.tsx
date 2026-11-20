/** @jsxImportSource preact */
import type { ButtonHTMLAttributes, JSX } from "preact";

const ring = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z";
const tick = "M20 6 9 17l-5-5";

// Lucide's icons (ISC), as path data on a 24 by 24 grid, some simplified.
const paths = {
  panel: ["M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M7 10h10", "M7 14h10"],
  chevron: ["m6 9 6 6 6-6"],
  close: ["M18 6 6 18", "m6 6 12 12"],
  check: [tick],
  off: [
    "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
    "M14.084 14.158a3 3 0 0 1-4.242-4.242",
    "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
    "m2 2 20 20",
  ],
  inspect: ["M12 2v4", "M12 18v4", "M2 12h4", "M18 12h4", "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"],
  pointer: ["M4 4l7 17 2.5-7.5L21 11z"],
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "m21 21-5-5"],
  arrow: ["M5 12h14", "m12 5 7 7-7 7"],
  // The flags a tree row shows.
  invalid: ["M12 3 2 21h20z", "M12 10v4", "M12 18h.01"],
  validating: ["M21 12a9 9 0 1 1-9-9"],
  dirty: ["M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"],
  edited: ["M9 4h6", "M9 20h6", "M12 4v16"],
  touched: [tick],
  disabled: [ring, "m6 6 12 12"],
  "read-only": ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
} as const;

export type IconName = keyof typeof paths;

/** An icon, hidden from assistive technology: the button around it carries the label. */
export function Icon({ name, class: className }: { readonly name: IconName; readonly class?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" class={className}>
      {paths[name].map((d) => (
        <path d={d} />
      ))}
    </svg>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes, "icon" | "label"> {
  /** Names the button for assistive technology, and is its tooltip unless `data-tip` says otherwise. */
  readonly label: string;
  readonly icon: IconName;
  readonly "data-tip"?: string;
}

/** A button that shows only an icon. */
export function IconButton({ label, icon, ...props }: IconButtonProps): JSX.Element {
  return (
    <button class="icon" data-tip={label} {...props} aria-label={label}>
      <Icon name={icon} />
    </button>
  );
}
