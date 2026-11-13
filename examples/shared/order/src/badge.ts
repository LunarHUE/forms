/** The class that runs the badge's flash animation. */
const flashClass = "flash";

/**
 * Adds one to the number a `.render-badge` element shows and restarts its
 * flash animation. Framework components call it from an effect that runs
 * after every render, so the badge counts renders without itself causing one.
 */
export function bumpBadge(element: HTMLElement): void {
  const count = Number(element.textContent);
  element.textContent = String(Number.isFinite(count) ? count + 1 : 1);
  restartFlash(element);
}

/**
 * Restarts the `.flash` animation on an element. Removing the class, reading
 * layout and adding it back makes the browser run the animation again.
 */
export function restartFlash(element: HTMLElement): void {
  element.classList.remove(flashClass);
  // Reading offsetWidth forces a style recalculation between the remove and the add.
  if (element.offsetWidth >= 0) element.classList.add(flashClass);
}
