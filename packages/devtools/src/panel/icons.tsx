/** @jsxImportSource preact */
import type { LucideIcon } from "lucide-preact";
import type { ButtonHTMLAttributes, JSX } from "preact";

/** An icon button's box: 32px with a 16px icon. */
export const iconBox = "inline-flex items-center justify-center size-8 rounded-md";

/** A small icon button's box: 20px with a 12px icon. */
export const smallBox = "inline-flex items-center justify-center size-5 rounded-sm [&_svg]:size-3";

/** An icon button's colours: soft, bright on hover, while its menu is open and while it is pressed. */
export const iconTone =
  "text-soft hover:bg-hover hover:text-fg aria-expanded:bg-hover aria-expanded:text-fg aria-pressed:bg-active aria-pressed:text-fg";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes, "icon" | "label"> {
  /** Names the button for assistive technology, and is its tooltip unless `data-tip` says otherwise. */
  readonly label: string;
  /** A Lucide icon. Lucide hides it from assistive technology, so the label is the button's only name. */
  readonly icon: LucideIcon;
  readonly "data-tip"?: string;
}

/** A button that shows only an icon, 32px unless `props` has a `class` of its own. */
export function IconButton({ label, icon: Icon, ...props }: IconButtonProps): JSX.Element {
  return (
    <button class={`${iconBox} ${iconTone}`} data-tip={label} {...props} aria-label={label}>
      <Icon />
    </button>
  );
}
