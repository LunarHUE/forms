import type { Path } from "@lunarhue/forms-core";
import { Fragment, h, type JSX, type TargetedMouseEvent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Hook } from "../hook.js";
import { type Corner, cornerLabels, corners, readCorner, saveCorner } from "./corner.js";
import { Bundle } from "./bundle.js";
import { Fields } from "./fields.js";
import { type Listed, listForms } from "./forms.js";
import { useFrame } from "./frame.js";
import { icon, iconButton } from "./icons.js";
import { ancestors, FieldCard, type Found, Outlines, useInspect } from "./inspect.js";
import { Log } from "./log.js";
import { Plugins } from "./plugins.js";

export type Tab = "fields" | "log" | "plugins" | "bundle";

const tabs: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: "fields", label: "Fields" },
  { id: "log", label: "Log" },
  { id: "plugins", label: "Plugins" },
  { id: "bundle", label: "Bundle" },
];

/** At this width and below the dock is a button that opens a bottom sheet. */
const phoneQuery = "(max-width: 640px)";

/** The handle at `path` in `form`, for its elements. */
const handleOf = (form: Listed | undefined, path: Path | null) => (form && path ? form.entry.store.fieldAt(path) : undefined);

/** The forms on the page, kept up to date through the hook's own `subscribe`. */
function useForms(hook: Hook): Listed[] {
  const [forms, setForms] = useState(() => listForms(hook));
  useEffect(() => {
    setForms(listForms(hook));
    const stop = hook.subscribe(() => setForms(listForms(hook)));
    return () => {
      stop();
    };
  }, [hook]);
  return forms;
}

function useMedia(query: string): boolean {
  const supported = typeof matchMedia === "function";
  const [matches, setMatches] = useState(() => supported && matchMedia(query).matches);
  useEffect(() => {
    if (!supported) return undefined;
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query, supported]);
  return matches;
}

/** Calls `close` on a press outside `inside` and on Escape, while `active`. */
function useDismiss(active: boolean, inside: () => readonly (Element | null)[], close: () => void): void {
  const latest = useRef({ inside, close });
  latest.current = { inside, close };
  useEffect(() => {
    if (!active) return undefined;
    const onPress = (event: Event) => {
      const path = event.composedPath();
      if (!latest.current.inside().some((element) => element !== null && path.includes(element))) latest.current.close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") latest.current.close();
    };
    document.addEventListener("pointerdown", onPress, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPress, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [active]);
}

/** What the Fields tab keeps for one form. It starts over when another form is shown. */
interface View {
  readonly form: number;
  readonly expanded: ReadonlySet<string>;
  readonly row: Path | null;
  readonly invalidOnly: boolean;
}

const fresh = (form: number): View => ({ form, expanded: new Set(), row: null, invalidOnly: false });

export interface AppProps {
  readonly hook: Hook;
  /** The element the shadow root is on. Clicks inside it are the panel's. */
  readonly host: HTMLElement;
}

/** The panel: a dock in a corner of the page, or a bottom sheet on a phone. */
export function App({ hook, host }: AppProps): JSX.Element {
  const forms = useForms(hook);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = forms.find((form) => form.id === selectedId);
  const shown = selected ?? forms[0];
  const [tab, setTab] = useState<Tab | null>(null);
  const [corner, setCorner] = useState<Corner>(readCorner);
  // The open menu, and its left edge: the left edge of the button that opened it.
  const [menu, setMenu] = useState<{ readonly kind: "dock" | "forms"; readonly left: number } | null>(null);
  const phone = useMedia(phoneQuery);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<View>(() => fresh(-1));
  const formId = shown?.id ?? -1;
  const current = view.form === formId ? view : fresh(formId);
  const updateView = (patch: (view: View) => Partial<View>) =>
    setView((previous) => {
      const base = previous.form === formId ? previous : fresh(formId);
      return { ...base, ...patch(base) };
    });

  const [inspecting, setInspecting] = useState(false);
  const [pinned, setPinned] = useState<Found | null>(null);
  const [rowHover, setRowHover] = useState<Path | null>(null);
  // Vue records no elements, so its forms never get an adapter and offer no inspecting.
  const tracked = forms.some((form) => form.entry.adapter !== undefined);

  const root = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtons = useRef<HTMLDivElement>(null);
  useDismiss(menu !== null, () => [menuRef.current, menuButtons.current], () => setMenu(null));

  // Escape unpins the card. Inspecting goes on until its toggle turns it off.
  useEffect(() => {
    if (pinned === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned]);

  /** Pins the card for a field the inspector clicked, and selects its row in the Fields tab. */
  const pin = (found: Found) => {
    setPinned(found);
    setSelectedId(found.form.id);
    setMenu(null);
    setTab("fields");
    setView((previous) => ({
      form: found.form.id,
      expanded: new Set([...(previous.form === found.form.id ? previous.expanded : []), ...ancestors(found.path)]),
      row: found.path,
      invalidOnly: false,
    }));
  };
  const hovered = useInspect({ hook, forms, host, on: inspecting, onPin: pin });

  /** Selects a form, which opens the panel on it, or clears the selection, which closes it. */
  const select = (id: number | null) => {
    setSelectedId(id);
    setMenu(null);
    if (id === null) {
      setTab(null);
      return;
    }
    setTab((open) => open ?? "fields");
    if (phone) setSheetOpen(true);
  };

  /** Opens the `kind` menu under the button of `event`, or closes it when it is open. */
  const toggleMenu = (kind: "dock" | "forms", event: TargetedMouseEvent<HTMLElement>) =>
    setMenu(menu?.kind === kind ? null : { kind, left: event.currentTarget.offsetLeft });

  /** Opens a tab, or closes the open one. A tab opened with no form selected selects the form it shows. */
  const openTab = (next: Tab) => {
    if (selected === undefined && shown) setSelectedId(shown.id);
    setTab(tab === next ? null : next);
  };

  const move = (next: Corner) => {
    setCorner(next);
    saveCorner(next);
    setMenu(null);
  };

  const onDisable = shown?.entry.onDisable;
  const turnOff = () => {
    setMenu(null);
    // Every form's own `onDisable`, once each, then a read of every `enabled`.
    for (const disable of new Set(forms.map((form) => form.entry.onDisable))) disable?.();
    hook.sync();
  };

  const content = (open: Tab): JSX.Element => {
    if (shown === undefined) return h("p", { class: "empty" }, "No form with devtools() is mounted on this page.");
    if (open === "log") return h(Log, { key: `${open}${shown.id}`, entry: shown.entry });
    if (open === "plugins") return h(Plugins, { key: `${open}${shown.id}`, entry: shown.entry });
    if (open === "bundle") return h(Bundle, { key: `${open}${shown.id}`, entry: shown.entry });
    return h(Fields, {
      key: `${open}${shown.id}`,
      entry: shown.entry,
      expanded: current.expanded,
      onToggle: (key) =>
        updateView(({ expanded }) => {
          const next = new Set(expanded);
          if (!next.delete(key)) next.add(key);
          return { expanded: next };
        }),
      row: current.row,
      onRow: (row) => updateView(() => ({ row })),
      invalidOnly: current.invalidOnly,
      onInvalidOnly: (invalidOnly) => updateView(() => ({ invalidOnly, row: null })),
      onHover: shown.entry.adapter === undefined ? undefined : setRowHover,
    });
  };

  const chip = h(
    "div",
    { class: "chip" },
    h(
      "button",
      {
        class: "chip-main",
        "aria-haspopup": "menu",
        "aria-expanded": menu?.kind === "forms" ? "true" : "false",
        "aria-label": selected ? `Form ${selected.label}. Choose a form` : "Choose a form",
        onClick: (event: TargetedMouseEvent<HTMLElement>) => toggleMenu("forms", event),
      },
      h("span", { class: selected ? "swatch on" : "swatch", "aria-hidden": "true" }),
      h("span", { class: selected ? "truncate" : "truncate muted" }, selected?.label ?? (forms.length === 0 ? "No forms" : "No form")),
      selected ? null : icon("chevron"),
    ),
    // The clear button takes the chevron's place.
    selected ? iconButton(`Clear selection ${selected.label}`, "close", { class: "icon small", "data-tip": "Clear selection", onClick: () => select(null) }) : null,
  );

  const formsMenu = h(
    "div",
    { class: "menu surface", role: "menu", "aria-label": "Forms on this page", ref: menuRef, style: `left: ${menu?.left ?? 0}px` },
    h("div", { class: "menu-label" }, "Forms on this page"),
    forms.length === 0
      ? h("div", { class: "menu-item muted" }, "None yet")
      : forms.map((form) =>
          h(
            "button",
            {
              key: form.id,
              class: "menu-item",
              role: "menuitemradio",
              "aria-checked": form.id === selectedId ? "true" : "false",
              onClick: () => select(form.id),
            },
            h("span", { class: form.id === selectedId ? "swatch on" : "swatch", "aria-hidden": "true" }),
            h("span", { class: "truncate" }, form.label),
            form.id === selectedId ? icon("check", "check") : null,
          ),
        ),
  );

  const dockMenu = h(
    "div",
    { class: "menu surface", role: "menu", "aria-label": "Devtools menu", ref: menuRef, style: `left: ${menu?.left ?? 0}px` },
    h("div", { class: "menu-label" }, "Dock position"),
    corners.map((option) =>
      h(
        "button",
        {
          key: option,
          class: "menu-item",
          role: "menuitemradio",
          "aria-checked": option === corner ? "true" : "false",
          onClick: () => move(option),
        },
        cornerLabels[option],
        option === corner ? icon("check", "check") : null,
      ),
    ),
    onDisable ? h("div", { class: "menu-separator", role: "separator" }) : null,
    onDisable ? h("button", { class: "menu-item", role: "menuitem", onClick: turnOff }, icon("off"), "Turn off devtools") : null,
  );

  const tabList = (active: Tab | null, onTab: (tab: Tab) => void) =>
    h(
      "div",
      { class: "tabs", role: "tablist", "aria-label": "Devtools tabs" },
      tabs.map((item) =>
        h(
          "button",
          { key: item.id, class: "tab", role: "tab", "aria-selected": active === item.id ? "true" : "false", onClick: () => onTab(item.id) },
          item.label,
        ),
      ),
    );

  const inspectButton = tracked
    ? iconButton("Inspect fields on the page", "inspect", {
        "aria-pressed": inspecting ? "true" : "false",
        "data-tip": inspecting ? "Stop inspecting" : "Inspect fields. Or hold Alt",
        onClick: () => setInspecting(!inspecting),
      })
    : null;

  // The elements of the field under the pointer, or of the hovered row.
  const card = hovered ?? pinned;
  const outlined = hovered
    ? handleOf(hovered.form, hovered.path)
    : tab === "fields" && shown?.entry.adapter !== undefined
      ? handleOf(shown, rowHover)
      : undefined;
  const fieldLayer = h(
    Fragment,
    null,
    outlined ? h(Outlines, { elements: hook.elementsOf(outlined) }) : null,
    card ? h(FieldCard, { key: card === pinned ? "pinned" : "hover", found: card, onClose: card === pinned ? () => setPinned(null) : undefined }) : null,
  );

  const layers = h(
    Fragment,
    null,
    h(FormOutlines, { hook, forms, selectedId, onPick: select }),
    fieldLayer,
    h(Tip, { root }),
  );

  const openMenu = menu?.kind === "dock" ? dockMenu : menu?.kind === "forms" ? formsMenu : null;

  if (phone) {
    const open = tab ?? "fields";
    return h(
      "div",
      { class: "root", ref: root },
      layers,
      sheetOpen
        ? h(
            "div",
            { class: "sheet surface", role: "dialog", "aria-label": "Forms devtools" },
            h("div", { class: "grip", "aria-hidden": "true" }),
            h(
              "div",
              { class: "sheet-head", ref: menuButtons },
              chip,
              inspectButton,
              h("div", { class: "end" }, onDisable ? iconButton("Turn off devtools", "off", { onClick: turnOff }) : null, iconButton("Close the devtools", "close", { onClick: () => setSheetOpen(false) })),
              openMenu,
            ),
            tabList(open, setTab),
            h("section", { class: "panel", "aria-label": `Devtools ${open}` }, content(open)),
          )
        : iconButton("Open the forms devtools", "panel", {
            class: "fab icon surface",
            onClick: () => {
              if (selected === undefined && shown) setSelectedId(shown.id);
              setSheetOpen(true);
            },
          }),
    );
  }

  return h(
    "div",
    { class: "root", ref: root },
    layers,
    h(
      "div",
      { class: "dock", "data-corner": corner },
      tab ? h("section", { class: "panel surface", "aria-label": `Devtools ${tab}` }, content(tab)) : null,
      h(
        "div",
        { class: "bar surface", role: "toolbar", "aria-label": "Forms devtools", ref: menuButtons },
        iconButton("Devtools menu", "panel", {
          "aria-haspopup": "menu",
          "aria-expanded": menu?.kind === "dock" ? "true" : "false",
          "data-tip": "Dock position and turning off",
          onClick: (event) => toggleMenu("dock", event),
        }),
        chip,
        h("div", { class: "divider", "aria-hidden": "true" }),
        inspectButton,
        tabList(tab, openTab),
        openMenu,
      ),
    ),
  );
}

interface FormOutlinesProps {
  readonly hook: Hook;
  readonly forms: readonly Listed[];
  readonly selectedId: number | null;
  readonly onPick: (id: number) => void;
}

/** How far a form's outline stands off its element. */
const pad = 8;

/**
 * A dashed outline around each form's `<form>` element, with the form's name
 * on a tag above it. The outline lets the pointer through; clicking the tag
 * selects the form. The selected form's outline is solid.
 */
function FormOutlines({ hook, forms, selectedId, onPick }: FormOutlinesProps): JSX.Element {
  const boxes = forms.flatMap((form) => hook.elementsOf(form.entry.store).map((element) => ({ form, rect: element.getBoundingClientRect() })));
  // The outlines follow the forms as the page scrolls or reflows.
  useFrame(() =>
    forms.flatMap((form) =>
      hook.elementsOf(form.entry.store).flatMap((element) => {
        const rect = element.getBoundingClientRect();
        return [form.id, rect.left, rect.top, rect.width, rect.height];
      }),
    ),
  );
  return h(
    Fragment,
    null,
    boxes.map(({ form, rect }, index) =>
      h(
        "div",
        {
          key: index,
          class: form.id === selectedId ? "outline form on" : "outline form",
          style: `left: ${rect.left - pad}px; top: ${rect.top - pad}px; width: ${rect.width + 2 * pad}px; height: ${rect.height + 2 * pad}px`,
        },
        h(
          "button",
          {
            // With no room above the form, the tag sits inside its top edge.
            class: rect.top - pad < 24 ? "tag inside" : "tag",
            "aria-label": `Select form ${form.label}`,
            "aria-pressed": form.id === selectedId ? "true" : "false",
            onClick: () => onPick(form.id),
          },
          icon("panel"),
          h("span", { class: "truncate" }, form.label),
        ),
      ),
    ),
  );
}

/** How long the pointer rests on a control before its tooltip shows. */
const tipDelay = 400;

/**
 * The tooltip of the control with a `data-tip` under the pointer or with the
 * keyboard focus. It is fixed to the window, so a scrolling list or the
 * panel's edge never clips it.
 */
function Tip({ root }: { readonly root: { readonly current: HTMLElement | null } }): JSX.Element | null {
  const [shown, setShown] = useState<{ readonly text: string; readonly rect: DOMRect } | null>(null);
  useEffect(() => {
    const element = root.current;
    if (element === null) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const target = (event: Event) => (event.target instanceof Element ? event.target.closest("[data-tip]") : null);
    const show = (found: Element | null) => {
      clearTimeout(timer);
      const text = found?.getAttribute("data-tip");
      setShown(found && text ? { text, rect: found.getBoundingClientRect() } : null);
    };
    const onOver = (event: Event) => {
      const found = target(event);
      clearTimeout(timer);
      if (found === null) return setShown(null);
      timer = setTimeout(() => show(found), tipDelay);
    };
    const onFocus = (event: Event) => show(event.target instanceof Element && event.target.matches(":focus-visible") ? target(event) : null);
    const hide = () => show(null);
    element.addEventListener("pointerover", onOver);
    element.addEventListener("pointerleave", hide);
    element.addEventListener("pointerdown", hide);
    element.addEventListener("focusin", onFocus);
    element.addEventListener("focusout", hide);
    return () => {
      clearTimeout(timer);
      element.removeEventListener("pointerover", onOver);
      element.removeEventListener("pointerleave", hide);
      element.removeEventListener("pointerdown", hide);
      element.removeEventListener("focusin", onFocus);
      element.removeEventListener("focusout", hide);
    };
  }, [root]);
  if (shown === null) return null;
  const { text, rect } = shown;
  // Above the control, or below it near the top of the window; kept off the window's sides.
  const above = rect.top > 40;
  const x = Math.max(80, Math.min(rect.left + rect.width / 2, innerWidth - 80));
  return h(
    "div",
    {
      class: above ? "tip" : "tip below",
      "aria-hidden": "true",
      style: `left: ${x}px; top: ${above ? rect.top - 6 : rect.bottom + 6}px`,
    },
    text,
  );
}
