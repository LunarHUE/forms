import { staggerIn } from "@/lib/motion";

/*
 * The sidebar rail's moving mark and its folding groups, for a NavTree's
 * <nav data-nav>. The nav is plain HTML on desktop, so this is vanilla DOM:
 * Shell attaches it to the desktop navs, MobileNav to the drawer's.
 *
 * One bar (data-nav-marker) rides the rail. It sits on the current page,
 * slides to the item under the mouse or keyboard focus, and slides back when
 * the pointer leaves. The client router keeps the nav across pages and Shell
 * moves aria-current before the swap; the bar slides to the new page once the
 * swap is done, since moving the nav into the new page would cut a slide short.
 *
 * Opening a group drops its items in one after another.
 *
 * Without script the links draw the mark themselves (a left border). Once
 * attached, the nav has data-rail and shell.css hides those borders.
 */
export function attachNav(nav: HTMLElement): () => void {
  const marker = nav.querySelector<HTMLElement>("[data-nav-marker]");
  if (!marker || nav.dataset.rail !== undefined) return () => {};
  nav.dataset.rail = "";

  const controller = new AbortController();
  const { signal } = controller;
  let hovered: HTMLElement | null = null;
  let swapping = false;
  let frame = 0;
  let slideNext = false;

  const current = () => nav.querySelector<HTMLElement>('a[aria-current="page"]');

  const place = (slide: boolean) => {
    // A folded group hides its links with content-visibility, which still
    // gives them boxes, so check for the closed <details> itself.
    if (hovered && !isShown(hovered)) {
      hovered = null;
      slide = true;
    }
    const target = hovered ?? current();
    if (!target || !isShown(target)) {
      delete marker.dataset.shown;
      return;
    }
    // A bar coming back from hidden lands in place instead of sliding in.
    const animate = slide && marker.dataset.shown !== undefined;
    if (animate) marker.dataset.sliding = "";
    else delete marker.dataset.sliding;
    const { left, top } = offsetIn(nav, target);
    marker.style.transform = `translate(${left}px, ${top}px)`;
    marker.style.height = `${target.offsetHeight}px`;
    marker.toggleAttribute("data-hover", target !== current());
    marker.dataset.shown = "";
  };

  const schedule = (slide: boolean) => {
    slideNext ||= slide;
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      if (swapping) return;
      place(slideNext);
      slideNext = false;
    });
  };

  const linkIn = (target: EventTarget | null) => {
    const link = target instanceof Element ? target.closest<HTMLElement>("a[href]") : null;
    return link && nav.contains(link) ? link : null;
  };

  nav.addEventListener(
    "pointerover",
    (event) => {
      const link = linkIn(event.target);
      if (event.pointerType !== "mouse" || !link || link === hovered) return;
      hovered = link;
      schedule(true);
    },
    { signal },
  );
  nav.addEventListener(
    "pointerleave",
    () => {
      if (!hovered) return;
      hovered = null;
      schedule(true);
    },
    { signal },
  );
  nav.addEventListener(
    "focusin",
    (event) => {
      const link = linkIn(event.target);
      if (!link?.matches(":focus-visible")) return;
      hovered = link;
      schedule(true);
    },
    { signal },
  );
  nav.addEventListener(
    "focusout",
    (event) => {
      if (event.target !== hovered) return;
      hovered = null;
      schedule(true);
    },
    { signal },
  );

  // A click on a closed group's summary opens it right after this handler,
  // so its items start hidden and drop in. Shell opening a group itself
  // (to show the current page) doesn't animate.
  nav.addEventListener(
    "click",
    (event) => {
      const summary = event.target instanceof Element ? event.target.closest("summary") : null;
      const group = summary?.parentElement;
      if (!(group instanceof HTMLDetailsElement) || group.open || !nav.contains(group)) return;
      staggerIn(group.querySelectorAll(":scope > ul > li"));
    },
    { signal },
  );

  const marks = new MutationObserver(() => schedule(true));
  marks.observe(nav, { attributeFilter: ["aria-current"], subtree: true });
  // Folding a group moves everything under it; the bar follows without sliding.
  const resize = new ResizeObserver(() => schedule(false));
  resize.observe(nav);
  // Folding the group the bar is on sends it back to the current page.
  nav.addEventListener("toggle", () => schedule(false), { capture: true, signal });

  document.addEventListener(
    "astro:before-swap",
    () => {
      swapping = true;
    },
    { signal },
  );
  document.addEventListener(
    "astro:after-swap",
    () => {
      swapping = false;
      if (nav.isConnected) schedule(true);
      else detach();
    },
    { signal },
  );

  function detach() {
    controller.abort();
    marks.disconnect();
    resize.disconnect();
    cancelAnimationFrame(frame);
    delete nav.dataset.rail;
  }

  place(false);
  return detach;
}

/**
 * Where `element` sits inside `nav`, from layout offsets. Client rects would
 * catch the rows of a just-opened group mid-drop. While a row animates, its
 * transform makes it the link's offsetParent, so walk up to the nav.
 */
function offsetIn(nav: HTMLElement, element: HTMLElement): { left: number; top: number } {
  let left = 0;
  let top = 0;
  let node: Element | null = element;
  while (node instanceof HTMLElement && node !== nav) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent;
  }
  return { left, top };
}

function isShown(element: HTMLElement): boolean {
  return !element.closest("details:not([open])") && element.getClientRects().length > 0;
}
