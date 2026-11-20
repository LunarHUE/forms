import { useEffect, useRef, useState } from "preact/hooks";

/**
 * Renders the calling component again on the next animation frame where an
 * item `read` returns differs, by `Object.is`, from the last read. Snapshots
 * keep their identity until they change, so `read` returns the snapshots
 * the component shows.
 *
 * The panel refreshes this way and never calls `store.subscribe`: a
 * subscription counts as a listener and would keep every plugin's
 * `onActive` open while the panel is.
 */
export function useFrame(read: () => readonly unknown[]): void {
  const [, setTick] = useState(0);
  const latest = useRef(read);
  latest.current = read;
  useEffect(() => {
    let last = latest.current();
    const tick = () => {
      const next = latest.current();
      if (next.length !== last.length || next.some((item, index) => !Object.is(item, last[index]))) {
        last = next;
        setTick((count) => count + 1);
      }
      frame = requestAnimationFrame(tick);
    };
    let frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
}
