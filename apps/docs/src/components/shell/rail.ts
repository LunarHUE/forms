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
    const target = hovered ?? current();
    if (!target || target.getClientRects().length === 0) {
      delete marker.dataset.shown;
      return;
    }
    const box = nav.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    // A bar coming back from hidden lands in place instead of sliding in.
    const animate = slide && marker.dataset.shown !== undefined;
    if (animate) marker.dataset.sliding = "";
    else delete marker.dataset.sliding;
    marker.style.transform = `translate(${rect.left - box.left}px, ${rect.top - box.top}px)`;
    marker.style.height = `${rect.height}px`;
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
