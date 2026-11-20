import type { Path } from "@lunarhue/forms-core";
import { Fragment, h, type JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Hook } from "../hook.js";
import { type Corner, cornerLabels, corners, readCorner, saveCorner } from "./corner.js";
import { Fields } from "./fields.js";
import { type Listed, listForms } from "./forms.js";
import { useFrame } from "./frame.js";
import { icon } from "./icons.js";
import { Log } from "./log.js";
import { Plugins } from "./plugins.js";

export type Tab = "fields" | "log" | "plugins";

const tabs: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: "fields", label: "Fields" },
  { id: "log", label: "Log" },
  { id: "plugins", label: "Plugins" },
];

/** At this width and below the dock is a button that opens a bottom sheet. */
const phoneQuery = "(max-width: 640px)";


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
  const [menu, setMenu] = useState<"dock" | "forms" | null>(null);
  const [picking, setPicking] = useState(false);
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

  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtons = useRef<HTMLDivElement>(null);
  useDismiss(menu !== null, () => [menuRef.current, menuButtons.current], () => setMenu(null));

  // Pick mode ends on Escape and on a click anywhere but an outline, which the outline handles.
  useEffect(() => {
    if (!picking) return undefined;
    const onClick = (event: MouseEvent) => {
      if (!event.composedPath().includes(host)) setPicking(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicking(false);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [picking, host]);

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
    });
  };

  const chip = h(
    "button",
    {
      class: "chip",
      "aria-haspopup": "menu",
      "aria-expanded": menu === "forms" ? "true" : "false",
      "aria-label": selected ? `Form ${selected.label}. Choose a form` : "Choose a form",
      onClick: () => setMenu(menu === "forms" ? null : "forms"),
    },
    h("span", { class: selected ? "swatch on" : "swatch", "aria-hidden": "true" }),
    h("span", { class: shown ? "truncate" : "truncate muted" }, shown?.label ?? "No forms"),
    icon("chevron"),
  );

  const formsMenu = h(
    "div",
    { class: "menu surface", role: "menu", "aria-label": "Forms on this page", ref: menuRef },
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
    { class: "menu surface", role: "menu", "aria-label": "Devtools menu", ref: menuRef },
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
      { role: "tablist", "aria-label": "Devtools tabs", style: "display: flex; gap: 2px" },
      tabs.map((item) =>
        h(
          "button",
          { key: item.id, class: "tab", role: "tab", "aria-selected": active === item.id ? "true" : "false", onClick: () => onTab(item.id) },
          item.label,
        ),
      ),
    );

  const pickButton = h(
    "button",
    {
      class: "icon",
      "aria-label": "Pick a form on the page",
      "aria-pressed": picking ? "true" : "false",
      onClick: () => setPicking(!picking),
    },
    icon("pick"),
  );

  const outlines = picking
    ? h(FormOutlines, {
        hook,
        forms,
        selectedId,
        onPick: (id: number) => {
          setPicking(false);
          select(id);
        },
      })
    : null;

  if (phone) {
    const open = tab ?? "fields";
    return h(
      "div",
      { class: "root" },
      outlines,
      sheetOpen
        ? h(
            "div",
            { class: "sheet surface", role: "dialog", "aria-label": "Forms devtools" },
            h("div", { class: "grip", "aria-hidden": "true" }),
            h(
              "div",
              { class: "sheet-head", ref: menuButtons },
              chip,
              pickButton,
              menu === "forms" ? formsMenu : null,
              h(
                "div",
                { class: "end" },
                tabList(open, setTab),
                onDisable ? h("button", { class: "icon", "aria-label": "Turn off devtools", onClick: turnOff }, icon("off")) : null,
                h("button", { class: "icon", "aria-label": "Close the devtools", onClick: () => setSheetOpen(false) }, icon("close")),
              ),
            ),
            h("section", { class: "panel", "aria-label": `Devtools ${open}` }, content(open)),
          )
        : h(
            "button",
            { class: "fab surface", "aria-label": "Open the forms devtools", onClick: () => setSheetOpen(true) },
            icon("panel"),
          ),
    );
  }

  return h(
    "div",
    { class: "root" },
    outlines,
    h(
      "div",
      { class: "dock", "data-corner": corner },
      tab ? h("section", { class: "panel surface", "aria-label": `Devtools ${tab}` }, content(tab)) : null,
      h(
        "div",
        { class: "bar surface", role: "toolbar", "aria-label": "Forms devtools", ref: menuButtons },
        h(
          "button",
          {
            class: "icon",
            "aria-label": "Devtools menu",
            "aria-haspopup": "menu",
            "aria-expanded": menu === "dock" ? "true" : "false",
            onClick: () => setMenu(menu === "dock" ? null : "dock"),
          },
          icon("panel"),
        ),
        chip,
        selected
          ? h("button", { class: "icon small", "aria-label": `Clear selection ${selected.label}`, onClick: () => select(null) }, icon("close"))
          : null,
        h("div", { class: "divider", "aria-hidden": "true" }),
        pickButton,
        tabList(tab, (next) => setTab(tab === next ? null : next)),
        menu === "dock" ? dockMenu : menu === "forms" ? formsMenu : null,
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

/** Pick mode's dashed outline and name tag over each form's `<form>` element. Clicking one picks that form. */
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
        "button",
        {
          key: index,
          class: form.id === selectedId ? "outline form on" : "outline form",
          style: `left: ${rect.left}px; top: ${rect.top}px; width: ${rect.width}px; height: ${rect.height}px`,
          "aria-label": `Pick form ${form.label}`,
          onClick: () => onPick(form.id),
        },
        h("span", { class: "tag truncate", "aria-hidden": "true" }, form.label),
      ),
    ),
  );
}
