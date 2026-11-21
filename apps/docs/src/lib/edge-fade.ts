/*
 * Soft edges on scroll areas. Mark the scrolling element with
 * `data-edge-fade="y"` (or `"x"`); wide prose tables get `"x"` here. While it
 * overflows it gets `data-edge-fade-on`, and `--edge-fade-start` and
 * `--edge-fade-end` go from 0 to 1 over the first 32px of content hidden
 * behind each edge. The mask itself is in styles/global.css.
 *
 * One capture-phase scroll listener and one MutationObserver on <html> cover
 * every page, so it keeps working across client-router swaps and on popups
 * that mount later. Scroll-driven animations would do this without a script,
 * but Firefox has none, and Lightning CSS folds `animation-timeline` into the
 * `animation` shorthand, where browsers reject it.
 */

const SELECTOR = "[data-edge-fade], .prose > table";
/** Pixels of hidden content over which an edge fades in fully. */
const DISTANCE = 32;

const tracked = new Set<HTMLElement>();
let frame = 0;

// Fires when the area or its content changes size without a DOM change:
// viewport resizes, fonts loading, folding nav groups.
const resizes = new ResizeObserver(() => schedule());

function ratio(hidden: number): string {
  // Under a pixel is subpixel rounding at the end of the scroll.
  return hidden < 1 ? "0" : String(Math.min(hidden / DISTANCE, 1));
}

function measure(element: HTMLElement): void {
  const sideways = element.dataset["edgeFade"] === "x";
  const position = sideways ? Math.abs(element.scrollLeft) : element.scrollTop;
  const range = sideways
    ? element.scrollWidth - element.clientWidth
    : element.scrollHeight - element.clientHeight;
  if (range < 1) {
    element.removeAttribute("data-edge-fade-on");
    return;
  }
  element.setAttribute("data-edge-fade-on", "");
  element.style.setProperty("--edge-fade-start", ratio(position));
  element.style.setProperty("--edge-fade-end", ratio(range - position));
}

function measureAll(): void {
  frame = 0;
  for (const element of tracked) {
    if (element.isConnected) measure(element);
    else {
      tracked.delete(element);
      resizes.unobserve(element);
    }
  }
}

function schedule(): void {
  if (frame === 0) frame = requestAnimationFrame(measureAll);
}

function track(element: HTMLElement): void {
  if (!element.dataset["edgeFade"]) element.dataset["edgeFade"] = "x";
  tracked.add(element);
  resizes.observe(element);
  for (const child of element.children) resizes.observe(child);
}

function scan(root: ParentNode): void {
  if (root instanceof HTMLElement && root.matches(SELECTOR)) track(root);
  for (const element of root.querySelectorAll<HTMLElement>(SELECTOR)) track(element);
}

function onScroll(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLElement && tracked.has(target)) measure(target);
}

let started = false;

/** Starts watching the document. Call once; later calls do nothing. */
export function startEdgeFade(): void {
  if (started) return;
  started = true;
  scan(document);
  schedule();
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  // Page swaps, popups and new search results add scroll areas or change what
  // is in them.
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement) scan(node);
      }
    }
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
}
