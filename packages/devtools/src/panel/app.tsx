/** @jsxImportSource preact */
import type { Path } from "@lunarhue/forms-core";
import { Check, ChevronDown, EyeOff, Locate, SquareEqual, X } from "lucide-preact";
import type { JSX, Ref, TargetedMouseEvent } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { FormEntry, Hook } from "../hook.js";
import { type Corner, cornerLabels, corners, readCorner, saveCorner } from "./corner.js";
import { Bundle } from "./bundle.js";
import { empty, panelRoot, surface } from "./classes.js";
import { Fields, type FieldsProps } from "./fields.js";
import { type Listed, listForms } from "./forms.js";
import { useFrame } from "./frame.js";
import { IconButton, iconTone, smallBox } from "./icons.js";
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

/** Where the dock sits, and which way it stacks the panel and the bar: the panel goes on the far side from the corner. */
export function dock(corner: Corner): string {
  return [
    "fixed z-[2147483000] flex gap-2 max-w-[calc(100vw-48px)]",
    corner.startsWith("bottom") ? "bottom-6 flex-col" : "top-6 flex-col-reverse",
    corner.endsWith("left") ? "left-6" : "right-6",
  ].join(" ");
}

/** A menu, under its button or above it, over the panel. */
const menuClass = (below: boolean) => `${surface} absolute z-2 flex flex-col w-[220px] p-1 ${below ? "top-[calc(100%+4px)]" : "bottom-[calc(100%+4px)]"}`;
const menuLabel = "pt-1.5 px-2 pb-0.5 font-sans text-xs/5 text-muted";
const menuItem = "flex items-center gap-2 h-8 px-2 rounded-sm font-sans text-left hover:bg-hover focus-visible:bg-hover focus-visible:outline-none";
const checkIcon = "size-3.5 ml-auto text-brand";
const swatch = (on: boolean) => `size-3 shrink-0 border-[1.5px] rounded-xs ${on ? "border-brand" : "border-muted"}`;

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
  readonly filter: string;
  readonly invalidOnly: boolean;
}

const fresh = (form: number): View => ({ form, expanded: new Set(), row: null, filter: "", invalidOnly: false });

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
      filter: "",
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

  const fields: FieldsState | undefined = shown && {
    expanded: current.expanded,
    onToggle: (key) =>
      updateView(({ expanded }) => {
        const next = new Set(expanded);
        if (!next.delete(key)) next.add(key);
        return { expanded: next };
      }),
    row: current.row,
    onRow: (row) => updateView(() => ({ row })),
    filter: current.filter,
    onFilter: (filter) => updateView(() => ({ filter })),
    invalidOnly: current.invalidOnly,
    onInvalidOnly: (invalidOnly) => updateView(() => ({ invalidOnly })),
    onHover: shown.entry.adapter === undefined ? undefined : setRowHover,
    onInspect:
      shown.entry.adapter === undefined
        ? undefined
        : (path) => {
            const handle = handleOf(shown, path);
            (handle && hook.elementsOf(handle)[0])?.scrollIntoView({ block: "center", behavior: "smooth" });
            setRowHover(path);
          },
  };

  // Menus open under their button on a phone and in a top corner, else above it.
  const menuBelow = phone || corner.startsWith("top");

  const chip = (
    <FormChip phone={phone} selected={selected} noForms={forms.length === 0} menuOpen={menu?.kind === "forms"} onMenu={(event) => toggleMenu("forms", event)} onClear={() => select(null)} />
  );

  const status = selected ? <SubmitStatus entry={selected.entry} /> : null;

  const inspectButton = tracked ? <InspectButton inspecting={inspecting} onToggle={() => setInspecting(!inspecting)} /> : null;

  // The elements of the field under the pointer, or of the hovered row.
  const card = hovered ?? pinned;
  const outlined = hovered
    ? handleOf(hovered.form, hovered.path)
    : tab === "fields" && shown?.entry.adapter !== undefined
      ? handleOf(shown, rowHover)
      : undefined;
  const fieldLayer = (
    <>
      {outlined ? <Outlines elements={hook.elementsOf(outlined)} /> : null}
      {card ? <FieldCard key={card === pinned ? "pinned" : "hover"} found={card} onClose={card === pinned ? () => setPinned(null) : undefined} /> : null}
    </>
  );

  const layers = (
    <>
      <FormOutlines hook={hook} forms={forms} selectedId={selectedId} onPick={select} />
      {fieldLayer}
      <Tip root={root} />
    </>
  );

  const openMenu =
    menu?.kind === "dock" ? (
      <DockMenu below={menuBelow} menuRef={menuRef} left={menu.left} corner={corner} onMove={move} onTurnOff={onDisable ? turnOff : undefined} />
    ) : menu?.kind === "forms" ? (
      <FormsMenu below={menuBelow} menuRef={menuRef} left={menu.left} forms={forms} selectedId={selectedId} onSelect={select} />
    ) : null;

  if (phone) {
    const open = tab ?? "fields";
    return (
      <div class={panelRoot} ref={root}>
        {layers}
        {sheetOpen ? (
          <div
            class="fixed inset-x-0 bottom-0 z-[2147483000] flex flex-col max-h-[70vh] bg-surface border-t border-line rounded-t-xl shadow-panel"
            role="dialog"
            aria-label="Forms devtools"
          >
            <div class="w-9 h-1 mt-2 mx-auto rounded-[2px] bg-thumb" aria-hidden="true" />
            <div class="relative flex items-center gap-0.5 h-12 px-2" ref={menuButtons}>
              {chip}
              {status}
              {inspectButton}
              <div class="flex ml-auto">
                {onDisable ? <IconButton label="Turn off devtools" icon={EyeOff} onClick={turnOff} /> : null}
                <IconButton label="Close the devtools" icon={X} onClick={() => setSheetOpen(false)} />
              </div>
              {openMenu}
            </div>
            <TabList phone active={open} onTab={setTab} />
            <section class="flex flex-col w-0 min-w-full min-h-32 overflow-hidden" aria-label={`Devtools ${open}`}>
              <TabContent tab={open} form={shown} fields={fields} />
            </section>
          </div>
        ) : (
          <IconButton
            label="Open the forms devtools"
            icon={SquareEqual}
            class={`fixed right-4 bottom-4 z-[2147483000] inline-flex items-center justify-center size-12 rounded-full bg-surface border border-line shadow-panel ${iconTone} [&_svg]:size-5`}
            onClick={() => {
              if (selected === undefined && shown) setSelectedId(shown.id);
              setSheetOpen(true);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div class={panelRoot} ref={root}>
      {layers}
      <div class={`dock ${dock(corner)}`} data-corner={corner}>
        {tab ? (
          <section class={`${surface} flex flex-col w-0 min-w-full max-h-[min(560px,calc(100vh-120px))] overflow-hidden`} aria-label={`Devtools ${tab}`}>
            <TabContent tab={tab} form={shown} fields={fields} />
          </section>
        ) : null}
        <div class={`${surface} relative flex items-center gap-0.5 h-10 px-[3px]`} role="toolbar" aria-label="Forms devtools" ref={menuButtons}>
          <IconButton
            label="Devtools menu"
            icon={SquareEqual}
            aria-haspopup="menu"
            aria-expanded={menu?.kind === "dock" ? "true" : "false"}
            data-tip="Dock position and turning off"
            onClick={(event) => toggleMenu("dock", event)}
          />
          {chip}
          {status}
          <div class="shrink-0 w-px h-4 mx-1 bg-line" aria-hidden="true" />
          {inspectButton}
          <TabList phone={false} active={tab} onTab={openTab} />
          {openMenu}
        </div>
      </div>
    </div>
  );
}

/** What the Fields tab takes besides the form. */
type FieldsState = Omit<FieldsProps, "entry">;

interface TabContentProps {
  readonly tab: Tab;
  /** The form the panel shows, if any. */
  readonly form: Listed | undefined;
  readonly fields: FieldsState | undefined;
}

/** The open tab's content for the shown form. */
function TabContent({ tab, form, fields }: TabContentProps): JSX.Element {
  if (form === undefined || fields === undefined) return <p class={empty}>No form with devtools() is mounted on this page.</p>;
  const key = `${tab}${form.id}`;
  if (tab === "log") return <Log key={key} entry={form.entry} />;
  if (tab === "plugins") return <Plugins key={key} entry={form.entry} />;
  if (tab === "bundle") return <Bundle key={key} entry={form.entry} />;
  return <Fields key={key} entry={form.entry} {...fields} />;
}

interface TabListProps {
  /** On a phone the tabs share the sheet's width. */
  readonly phone: boolean;
  readonly active: Tab | null;
  readonly onTab: (tab: Tab) => void;
}

/** The row of tabs. */
function TabList({ phone, active, onTab }: TabListProps): JSX.Element {
  return (
    <div class={phone ? "flex gap-0.5 px-2 pb-2 border-b border-line" : "flex gap-0.5"} role="tablist" aria-label="Devtools tabs">
      {tabs.map((item) => (
        <button
          key={item.id}
          class={`${phone ? "flex-1 " : ""}h-8 px-2.5 rounded-md font-sans text-sm/5 text-soft whitespace-nowrap hover:text-fg hover:bg-hover aria-selected:bg-active aria-selected:text-fg`}
          role="tab" aria-selected={active === item.id ? "true" : "false"} onClick={() => onTab(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface FormChipProps {
  /** On a phone the chip takes the room it needs. */
  readonly phone: boolean;
  readonly selected: Listed | undefined;
  /** True when the page has no forms. */
  readonly noForms: boolean;
  readonly menuOpen: boolean;
  readonly onMenu: (event: TargetedMouseEvent<HTMLElement>) => void;
  readonly onClear: () => void;
}

/** The selected form's name, which opens the forms menu, and the button that clears the selection. */
function FormChip({ phone, selected, noForms, menuOpen, onMenu, onClear }: FormChipProps): JSX.Element {
  return (
    <div class={`flex items-center min-w-0 ${phone ? "max-w-none" : "max-w-[180px]"} h-8 pr-1.5 rounded-md hover:bg-hover has-[[aria-expanded=true]]:bg-hover`}>
      <button
        class="chip-main flex items-center gap-1.5 min-w-0 h-full pl-2"
        aria-haspopup="menu"
        aria-expanded={menuOpen ? "true" : "false"}
        aria-label={selected ? `Form ${selected.label}. Choose a form` : "Choose a form"}
        onClick={onMenu}
      >
        <span class={swatch(selected !== undefined)} aria-hidden="true" />
        <span class={selected ? "truncate" : "truncate text-muted"}>{selected?.label ?? (noForms ? "No forms" : "No form")}</span>
        {selected ? null : <ChevronDown class="size-3 text-muted" />}
      </button>
      {/* The clear button takes the chevron's place. */}
      {selected ? (
        <IconButton
          label={`Clear selection ${selected.label}`}
          icon={X}
          class={`${smallBox} ml-0.5 text-muted hover:bg-hover`}
          data-tip="Clear selection"
          onClick={onClear}
        />
      ) : null}
    </div>
  );
}

interface MenuProps {
  /** Opens the menu under its button rather than above it. */
  readonly below: boolean;
  readonly menuRef: Ref<HTMLDivElement>;
  /** The menu's left edge: the left edge of the button that opened it. */
  readonly left: number;
}

interface FormsMenuProps extends MenuProps {
  readonly forms: readonly Listed[];
  readonly selectedId: number | null;
  readonly onSelect: (id: number) => void;
}

/** The menu of the forms on the page. */
function FormsMenu({ below, menuRef, left, forms, selectedId, onSelect }: FormsMenuProps): JSX.Element {
  return (
    <div class={menuClass(below)} role="menu" aria-label="Forms on this page" ref={menuRef} style={`left: ${left}px`}>
      <div class={menuLabel}>Forms on this page</div>
      {forms.length === 0 ? (
        <div class={`${menuItem} text-muted`}>None yet</div>
      ) : (
        forms.map((form) => (
          <button key={form.id} class={menuItem} role="menuitemradio" aria-checked={form.id === selectedId ? "true" : "false"} onClick={() => onSelect(form.id)}>
            <span class={swatch(form.id === selectedId)} aria-hidden="true" />
            <span class="truncate">{form.label}</span>
            {form.id === selectedId ? <Check class={checkIcon} /> : null}
          </button>
        ))
      )}
    </div>
  );
}

interface DockMenuProps extends MenuProps {
  readonly corner: Corner;
  readonly onMove: (corner: Corner) => void;
  /** Turns the devtools off. Unset when the form can't. */
  readonly onTurnOff?: (() => void) | undefined;
}

/** The dock's menu: the corner it sits in, and turning the devtools off. */
function DockMenu({ below, menuRef, left, corner, onMove, onTurnOff }: DockMenuProps): JSX.Element {
  return (
    <div class={menuClass(below)} role="menu" aria-label="Devtools menu" ref={menuRef} style={`left: ${left}px`}>
      <div class={menuLabel}>Dock position</div>
      {corners.map((option) => (
        <button key={option} class={menuItem} role="menuitemradio" aria-checked={option === corner ? "true" : "false"} onClick={() => onMove(option)}>
          {cornerLabels[option]}
          {option === corner ? <Check class={checkIcon} /> : null}
        </button>
      ))}
      {onTurnOff ? <div class="h-px -mx-1 my-1 bg-line" role="separator" /> : null}
      {onTurnOff ? (
        <button class={menuItem} role="menuitem" onClick={onTurnOff}>
          <EyeOff class="size-3.5 text-muted" />
          Turn off devtools
        </button>
      ) : null}
    </div>
  );
}

interface InspectButtonProps {
  readonly inspecting: boolean;
  readonly onToggle: () => void;
}

/** The toggle that inspects fields on the page. */
function InspectButton({ inspecting, onToggle }: InspectButtonProps): JSX.Element {
  return (
    <IconButton
      label="Inspect fields on the page"
      icon={Locate}
      aria-pressed={inspecting ? "true" : "false"}
      data-tip={inspecting ? "Stop inspecting" : "Inspect fields. Or hold Alt"}
      onClick={onToggle}
    />
  );
}

interface SubmitStatusProps {
  readonly entry: FormEntry;
}

/** The form's last submission, as `submit failed` and the like. Nothing before the first. */
function SubmitStatus({ entry }: SubmitStatusProps): JSX.Element | null {
  const last = () => entry.submissions.items[entry.submissions.items.length - 1]?.status;
  const status = last();
  useFrame(() => [last()]);
  if (status === undefined) return null;
  return (
    <span class="status shrink-0 px-1.5 font-sans text-sm/5 text-muted whitespace-nowrap" data-status={status}>
      submit <span class={status === "failed" || status === "invalid" ? "text-error" : "text-soft"}>{status === "open" ? "running" : status}</span>
    </span>
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
  return (
    <>
      {boxes.map(({ form, rect }, index) => (
        <div
          key={index}
          class={`form-outline fixed z-[2147482999] pointer-events-none border rounded-[0_6px_6px_6px] ${
            form.id === selectedId ? "on border-brand" : "border-dashed border-outline has-[button:hover]:border-brand"
          }`}
          style={`left: ${rect.left - pad}px; top: ${rect.top - pad}px; width: ${rect.width + 2 * pad}px; height: ${rect.height + 2 * pad}px`}
        >
          <button
            // With no room above the form, the tag sits inside its top edge.
            class={`absolute -left-px flex items-center gap-1.5 max-w-[calc(100%+2px)] h-6 px-2 font-mono text-xs/4 text-white pointer-events-auto hover:bg-brand ${
              form.id === selectedId ? "bg-brand" : "bg-surface"
            } ${rect.top - pad < 24 ? "-top-px rounded-[0_0_4px_0]" : "bottom-full rounded-t-sm"}`}
            aria-label={`Select form ${form.label}`}
            aria-pressed={form.id === selectedId ? "true" : "false"}
            onClick={() => onPick(form.id)}
          >
            <SquareEqual class="size-3" />
            <span class="truncate">{form.label}</span>
          </button>
        </div>
      ))}
    </>
  );
}

/** How long the pointer rests on a control before its tooltip shows. */
const tipDelay = 400;

interface TipProps {
  readonly root: { readonly current: HTMLElement | null };
}

/**
 * The tooltip of the control with a `data-tip` under the pointer or with the
 * keyboard focus. It is fixed to the window, so a scrolling list or the
 * panel's edge never clips it.
 */
function Tip({ root }: TipProps): JSX.Element | null {
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
  return (
    <div
      class={`fixed z-[2147483002] max-w-[220px] py-1 px-2 border border-line rounded-md bg-raised font-sans text-xs/4 text-fg pointer-events-none -translate-x-1/2 ${above ? "-translate-y-full" : ""}`}
      aria-hidden="true"
      style={`left: ${x}px; top: ${above ? rect.top - 6 : rect.bottom + 6}px`}
    >
      {text}
    </div>
  );
}
