/** @jsxImportSource preact */
import type { LucideIcon } from "lucide-preact";
import type { ButtonHTMLAttributes, JSX } from "preact";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes, "icon" | "label"> {
  /** Names the button for assistive technology, and is its tooltip unless `data-tip` says otherwise. */
  readonly label: string;
  /** A Lucide icon. Lucide hides it from assistive technology, so the label is the button's only name. */
  readonly icon: LucideIcon;
  readonly "data-tip"?: string;
}

/** A button that shows only an icon. */
export function IconButton({ label, icon: Icon, ...props }: IconButtonProps): JSX.Element {
  return (
    <button class="icon" data-tip={label} {...props} aria-label={label}>
      <Icon />
    </button>
  );
}
