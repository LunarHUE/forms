/** @jsxImportSource preact */
import type { Path } from "@lunarhue/forms-core";
import { X } from "lucide-preact";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Hook } from "../hook.js";
import { surface } from "./classes.js";
import { detailHead, detailName, FieldFacts } from "./fields.js";
import type { Listed } from "./forms.js";
import { useFrame } from "./frame.js";
import { IconButton, iconTone, smallBox } from "./icons.js";
import { pathKey } from "./values.js";

/** A field found on the page: its form, its stable path and the element the pointer is over. */
export interface Found {
  readonly form: Listed;
  readonly path: Path;
  readonly element: Element;
}

/** Whether a key from `hook.keyOf` is a field handle rather than a store. */
const isHandle = (key: object): key is { readonly store: object; readonly path: Path } => "path" in key && "store" in key;

/**
 * The elements a label stands for: its control, the element its `for` names
 * when that isn't labelable, such as a custom input, and what it wraps.
 */
function labelled(label: HTMLLabelElement): Element[] {
  const root = label.getRootNode();
  const named = label.htmlFor && (root instanceof Document || root instanceof ShadowRoot) ? root.getElementById(label.htmlFor) : null;
  return [label.control, named, ...label.querySelectorAll("*")].filter((element): element is Element => element !== null);
}

/**
 * The field under an event, from the first element on its composed path that
 * a ref recorded. A label counts as the field it labels. Undefined for an
 * event inside the panel, or over no field of a listed form.
 */
export function fieldAt(hook: Hook, forms: readonly Listed[], host: Element, path: readonly EventTarget[]): Found | undefined {
  if (path.includes(host)) return undefined;
  for (const target of path) {
    if (!(target instanceof Element)) continue;
    for (const element of target instanceof HTMLLabelElement ? [target, ...labelled(target)] : [target]) {
      const key = hook.keyOf(element);
      if (key === undefined || !isHandle(key)) continue;
      const form = forms.find((listed) => listed.entry.store === key.store);
      if (form) return { form, path: key.path, element };
    }
  }
  return undefined;
}

/** The keys of every row above `path` in the tree, which must be expanded to show it. */
export const ancestors = (path: Path): string[] => path.slice(0, -1).map((_, index) => pathKey(path.slice(0, index + 1)));

/** How far apart a label and its control can be for the gap between them to keep the card. */
const bridgeGap = 32;

/** How long the card stays after the pointer leaves its field, so crossing a small gap doesn't flicker it. */
const grace = 150;

/** The labels of a control: those its `labels` lists, one that wraps it, and those whose `for` names it. */
function labelsOf(element: Element): Element[] {
  const labels = new Set<Element>();
  if ("labels" in element && element.labels instanceof NodeList) for (const label of element.labels) if (label instanceof Element) labels.add(label);
  const wrapping = element.closest("label");
  if (wrapping) labels.add(wrapping);
  const root = element.getRootNode();
  if (element.id && (root instanceof Document || root instanceof ShadowRoot))
    for (const label of root.querySelectorAll(`label[for="${CSS.escape(element.id)}"]`)) labels.add(label);
  return [...labels];
}

/** The distance between two boxes, along the axis they are furthest apart on. Zero when they overlap. */
const distance = (a: DOMRect, b: DOMRect) => Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom, 0);

/**
 * Whether a point is in the box spanning a control and its labels that sit
 * within `bridgeGap` of it. The pointer crosses that box going from a label
 * to its input. A label further away bridges nothing, so it can't make a
 * large stretch of the page keep the card.
 */
export function inBridge(element: Element, x: number, y: number): boolean {
  const own = element.getBoundingClientRect();
  const near = labelsOf(element)
    .map((label) => label.getBoundingClientRect())
    .filter((rect) => distance(rect, own) <= bridgeGap);
  if (near.length === 0) return false;
  const boxes = [own, ...near];
  const left = Math.min(...boxes.map((box) => box.left));
  const right = Math.max(...boxes.map((box) => box.right));
  const top = Math.min(...boxes.map((box) => box.top));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return x >= left && x <= right && y >= top && y <= bottom;
}

export interface InspectOptions {
  readonly hook: Hook;
  readonly forms: readonly Listed[];
  readonly host: Element;
  /** True while the inspect toggle is on. Holding Alt inspects without it. */
  readonly on: boolean;
  /** Called with the field a click landed on while inspecting. The click goes no further. */
  readonly onPin: (found: Found) => void;
}

/**
 * The field under the pointer while inspecting: with the toggle on, or while
 * Alt is held. Listens on the document in the capture phase, so a click that
 * pins a field never reaches the page.
 */
export function useInspect({ hook, forms, host, on, onPin }: InspectOptions): Found | undefined {
  const [found, setFound] = useState<Found | undefined>(undefined);
  const latest = useRef({ forms, on, onPin, found });
  latest.current = { forms, on, onPin, found };
  useEffect(() => {
    // The last pointer path and place, so pressing Alt over a field shows it without a move.
    let last: readonly EventTarget[] = [];
    let point: readonly [x: number, y: number] | undefined;
    // Clears the card once the pointer has been off its field for `grace`.
    let leaving: ReturnType<typeof setTimeout> | undefined;
    const stopLeaving = () => {
      clearTimeout(leaving);
      leaving = undefined;
    };
    const show = (active: boolean) => {
      const next = active ? fieldAt(hook, latest.current.forms, host, last) : undefined;
      const { found: current } = latest.current;
      if (active && next === undefined && current) {
        // Between a label and its input the card stays. Anywhere else it goes after the grace period.
        if (point && inBridge(current.element, ...point)) stopLeaving();
        else leaving ??= setTimeout(() => {
          leaving = undefined;
          setFound(undefined);
        }, grace);
        return;
      }
      stopLeaving();
      setFound((previous) =>
        previous?.element === next?.element && previous?.form === next?.form && pathKey(previous?.path ?? []) === pathKey(next?.path ?? [])
          ? previous
          : next,
      );
    };
    const onMove = (event: PointerEvent) => {
      last = event.composedPath();
      point = [event.clientX, event.clientY];
      show(latest.current.on || event.altKey);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Alt") show(latest.current.on || event.type === "keydown");
    };
    const onClick = (event: MouseEvent) => {
      if (!latest.current.on && !event.altKey) return;
      const hit = fieldAt(hook, latest.current.forms, host, event.composedPath());
      if (hit === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      stopLeaving();
      setFound(undefined);
      latest.current.onPin(hit);
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKey, true);
    document.addEventListener("click", onClick, true);
    return () => {
      stopLeaving();
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keyup", onKey, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [hook, host]);
  // Turning the toggle off drops a card it showed.
  useEffect(() => {
    if (!on) setFound(undefined);
  }, [on]);
  return found;
}

const rectOf = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return [rect.left, rect.top, rect.width, rect.height] as const;
};

export interface OutlinesProps {
  readonly elements: readonly Element[];
}

/** A solid outline over each element, following it as the page scrolls or reflows. */
export function Outlines({ elements }: OutlinesProps): JSX.Element {
  useFrame(() => elements.flatMap((element) => rectOf(element)));
  return (
    <>
      {elements.map((element, index) => {
        const [left, top, width, height] = rectOf(element);
        return (
          <div
            key={index}
            class="field-outline fixed z-[2147482999] pointer-events-none border-2 border-brand rounded-sm bg-brand-tint"
            style={`left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px`}
            aria-hidden="true"
          />
        );
      })}
    </>
  );
}

/** How far the card keeps from the element and the window's edges. */
const gap = 8;
const cardWidth = 320;

export interface FieldCardProps {
  readonly found: Found;
  /** Set on a pinned card, which has a close button. */
  readonly onClose?: (() => void) | undefined;
}

/** The hover card: a field's value, baseline and writes in a card next to its element. */
export function FieldCard({ found, onClose }: FieldCardProps): JSX.Element | null {
  const { form, path, element } = found;
  const { entry } = form;
  const connected = element.isConnected;
  const snapshot = entry.store.getSnapshot(path);
  useFrame(() => [
    entry.store.getSnapshot(path),
    entry.ctx.baseline.read(path)?.value,
    entry.lastWrite.get(pathKey(path)),
    element.isConnected,
    ...rectOf(element),
  ]);
  if (!connected) return null;
  const rect = element.getBoundingClientRect();
  const width = Math.min(cardWidth, innerWidth - 2 * gap);
  const left = Math.max(gap, Math.min(rect.left, innerWidth - width - gap));
  // Below the element when it is in the top half of the window, else above it.
  const below = rect.top + rect.height / 2 < innerHeight / 2;
  const place = below ? `top: ${rect.bottom + gap}px` : `bottom: ${innerHeight - rect.top + gap}px`;
  return (
    <section class={`card ${surface} fixed z-[2147483001] flex flex-col max-h-[min(420px,calc(100vh-16px))] overflow-x-hidden overflow-y-auto`} style={`left: ${left}px; width: ${width}px; ${place}`} aria-label={`Field ${snapshot.name || "(form)"}`}>
      <div class={detailHead}>
        <strong class={detailName}>{snapshot.name || "(form)"}</strong>
        {onClose ? <IconButton label="Unpin the field card" icon={X} class={`${smallBox} ${iconTone}`} onClick={onClose} /> : null}
      </div>
      <FieldFacts entry={entry} path={path} snapshot={snapshot} />
    </section>
  );
}
