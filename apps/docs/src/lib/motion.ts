/*
 * Entrance motion for lists that open: menus, the picker, search results and
 * folding groups. Each item fades and drops in, 30ms after the one before.
 * Nothing moves when the reader asks for reduced motion.
 */

/** Rows in a menu, combobox or command list. */
export const MENU_ROWS = '[data-slot$="-item"], [data-slot$="-label"], [data-slot$="-sub-trigger"], [cmdk-group-heading]';

const STEP = 30;
const DURATION = 180;
/** Rows past this one share its delay, so a long list doesn't trail on. */
const MAX_STEPS = 10;
const EASE_OUT = "cubic-bezier(0.215, 0.61, 0.355, 1)";

export function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Fades `elements` in, in order. Call it before the browser paints them. */
export function staggerIn(elements: Iterable<Element>): void {
  if (prefersReducedMotion()) return;
  let index = 0;
  for (const element of elements) {
    element.animate(
      [
        { opacity: 0, transform: "translateY(-4px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: DURATION, delay: Math.min(index, MAX_STEPS) * STEP, easing: EASE_OUT, fill: "backwards" },
    );
    index += 1;
  }
}

/**
 * Staggers the rows matching `selector` inside `root` now, and every batch of
 * rows added later (a new set of search results). Rows already shown don't
 * move again. Returns the cleanup.
 */
export function watchStagger(root: Element, selector: string): () => void {
  const seen = new WeakSet<Element>();
  const run = () => {
    const fresh = [...root.querySelectorAll(selector)].filter((element) => !seen.has(element));
    for (const element of fresh) seen.add(element);
    staggerIn(fresh);
  };
  run();
  // Mutation callbacks run before the next paint, so new rows never flash in.
  const observer = new MutationObserver(run);
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
