import { useEffect, useRef, useState } from "preact/hooks";

/**
 * Renders the calling component again on the next animation frame where an
 * item `read` returns differs, by `Object.is`, from what it returned during
 * the last render. Snapshots keep their identity until they change, so
 * `read` returns the snapshots the component shows.
 *
 * The comparison starts from the render, not from the effect: Preact runs
 * effects a frame after it renders, and a write in between would otherwise
 * become the starting point and never show.
 *
 * The panel refreshes this way and never calls `store.subscribe`: a
 * subscription counts as a listener and would keep every plugin's
 * `onActive` open while the panel is.
 */
export function useFrame(read: () => readonly unknown[]): void {
  const [, setTick] = useState(0);
  const latest = useRef(read);
  latest.current = read;
  const shown = useRef<readonly unknown[]>([]);
  shown.current = read();
  useEffect(() => {
    const tick = () => {
      const next = latest.current();
      const last = shown.current;
      if (next.length !== last.length || next.some((item, index) => !Object.is(item, last[index]))) {
        shown.current = next;
        setTick((count) => count + 1);
      }
      frame = requestAnimationFrame(tick);
    };
    let frame = requestAnimationFrame(tick);
    // A page torn down before the panel (a test environment closing) has no
    // frames left to cancel, and no `cancelAnimationFrame` either.
    return () => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
    };
  }, []);
}
