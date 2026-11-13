import { bumpBadge } from "@lunarhue/forms-example-order";
import { type Ref, type RefObject, useEffect, useRef } from "react";

/**
 * Counts the commits of the component that calls it, and returns the ref to
 * pass to that component's `RenderBadge` as `counter`.
 *
 * The count lives in the badge's DOM text, not in React state, so showing it
 * never causes a render of its own. An effect with no dependency list runs
 * after every commit of the calling component, and `bumpBadge` adds one to
 * the text there. Nothing is counted during render: the React Compiler
 * forbids writing refs in render, and StrictMode renders twice.
 *
 * Why a hook and not a component that counts its own renders: the React
 * Compiler caches `<RenderBadge />` in the parent, since none of its props
 * change. React then skips the badge when the parent re-renders, and the
 * badge would stay at 1. The effect has to belong to the component whose
 * commits it counts.
 */
export function useRenderBadge(): RefObject<HTMLSpanElement | null> {
  const badge = useRef<HTMLSpanElement>(null);
  const remounting = useRef(false);

  useEffect(() => {
    // In development StrictMode mounts every component twice: it runs the
    // effects, runs their cleanups, then runs the effects again, with no
    // render in between. The effect below has an empty dependency list, so
    // its cleanup runs only on that simulated unmount (or a real one), and
    // it flags the setup that follows as the same commit. So a field that
    // just mounted reads 1, as it does in production.
    if (remounting.current) {
      remounting.current = false;
      return;
    }
    if (badge.current) bumpBadge(badge.current);
  });

  useEffect(
    () => () => {
      remounting.current = true;
    },
    [],
  );

  return badge;
}

/** Props for `RenderBadge`. */
export interface RenderBadgeProps {
  /** What `useRenderBadge` returned in the component this badge belongs to. */
  readonly counter: Ref<HTMLSpanElement>;
  /** What the badge counts, such as a field name. It ends up in `data-badge` and the tooltip. */
  readonly name: string;
}

/**
 * The pill that shows a component's commit count. It renders a constant
 * "0", which `useRenderBadge` overwrites in the DOM after each commit. React
 * never sees the text change, so it never writes it back. It is hidden from
 * assistive technology so it stays out of label text.
 */
export function RenderBadge({ counter, name }: RenderBadgeProps) {
  return (
    <span className="render-badge" ref={counter} data-badge={name} title={`Commits of ${name}`} aria-hidden="true">
      0
    </span>
  );
}
