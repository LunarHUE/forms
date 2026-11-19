/** How many demos each page has rendered so far. A page render has its own Request. */
const counts = new WeakMap<Request, number>();

/**
 * An id for a demo that is unique on its page and the same on every build:
 * `masks/contact#1`, then `masks/contact#2` for a second demo on that page.
 */
export function demoId(request: Request, name: string): string {
  const index = (counts.get(request) ?? 0) + 1;
  counts.set(request, index);
  return `${name}#${index}`;
}
