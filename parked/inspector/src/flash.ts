/** The class that runs a cell's flash animation, from `styles.css`. */
const flashClass = "flash";

/**
 * Restarts the `.flash` animation on an element. Removing the class, reading
 * layout and adding it back makes the browser run the animation again.
 */
export function restartFlash(element: HTMLElement): void {
  element.classList.remove(flashClass);
  // Reading offsetWidth forces a style recalculation between the remove and the add.
  if (element.offsetWidth >= 0) element.classList.add(flashClass);
}
