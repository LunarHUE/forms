/** Where the dock sits on a wide screen. Phones get a bottom sheet instead. */
export const corners = ["bottom-left", "bottom-right", "top-left", "top-right"] as const;
export type Corner = (typeof corners)[number];

export const cornerLabels: Readonly<Record<Corner, string>> = {
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
  "top-left": "Top left",
  "top-right": "Top right",
};

/** The localStorage key the corner is kept under, for every page of the origin. */
export const cornerKey = "lunarhue.forms.devtools.corner";

const isCorner = (value: unknown): value is Corner => corners.some((corner) => corner === value);

/** The saved corner, or bottom left. Storage can be off or throw, as in a sandboxed frame. */
export function readCorner(): Corner {
  try {
    const saved = localStorage.getItem(cornerKey);
    return isCorner(saved) ? saved : "bottom-left";
  } catch {
    return "bottom-left";
  }
}

export function saveCorner(corner: Corner): void {
  try {
    localStorage.setItem(cornerKey, corner);
  } catch {
    // The dock still moves on this page.
  }
}
