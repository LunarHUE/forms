/** @jsxImportSource preact */
import { errorsByKind, type FieldSnapshot, invalidFields, type Path } from "@lunarhue/forms-core";
import {
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  CircleSmall,
  LoaderCircle,
  Lock,
  type LucideIcon,
  MousePointer2,
  Search,
  TextCursor,
  TriangleAlert,
  X,
} from "lucide-preact";
import type { ComponentChildren, JSX } from "preact";
import { useState } from "preact/hooks";
import type { FormEntry, LoggedWrite } from "../hook.js";
import { hasPlugin } from "./forms.js";
import { useFrame } from "./frame.js";
import { empty, scroll } from "./classes.js";
import { IconButton, iconTone, smallBox } from "./icons.js";
import { causeText, clock, errorsPage, pathKey, preview, readError, shapeOf } from "./values.js";

type Snapshot = FieldSnapshot<unknown, unknown>;

/** One row of the value tree. */
export interface Row {
  readonly path: Path;
  /** The key, or the index for an array item. */
  readonly label: string;
  readonly depth: number;
  readonly snapshot: Snapshot;
  /** Whether the row can expand. */
  readonly branch: boolean;
}

/** The children of a field: each child's stable path segment and the label it shows. */
function childrenOf(snapshot: Snapshot): (readonly [segment: string, label: string])[] {
  const { value } = snapshot;
  // An array's stable path segments are its item keys. The label is the index.
  if (Array.isArray(value)) return (snapshot.keys ?? []).map((key, index) => [key, String(index)] as const);
  if (value !== null && typeof value === "object" && shapeOf(value) === "object") return Object.keys(value).map((key) => [key, key] as const);
  return [];
}

/**
 * The rows the tree shows: the root's children, and the children of every
 * row `open` says is expanded. Reading a path makes its node in the store,
 * so the walk stays inside what is expanded, unless a filter asks for every
 * row. The root shows as a row of its own only while it has errors, which
 * are the form's.
 */
export function treeRows(entry: FormEntry, open: (key: string) => boolean): Row[] {
  const { store } = entry;
  const rows: Row[] = [];
  const root = store.getSnapshot([]);
  if (root.errors.length > 0) rows.push({ path: [], label: "(form)", depth: 0, snapshot: root, branch: false });
  const visit = (path: Path, snapshot: Snapshot, depth: number) => {
    for (const [segment, label] of childrenOf(snapshot)) {
      const child = [...path, segment];
      const childSnapshot = store.getSnapshot(child);
      const branch = shapeOf(childSnapshot.value) !== "leaf";
      rows.push({ path: child, label, depth, snapshot: childSnapshot, branch });
      if (branch && open(pathKey(child))) visit(child, childSnapshot, depth + 1);
    }
  };
  visit([], root, 0);
  return rows;
}

/** A row in a flat list, labelled with the field's whole name. */
const flat = (row: Row): Row => ({ ...row, label: row.snapshot.name || "(form)", depth: 0, branch: false });

/**
 * The rows the Fields tab shows. With no filter, the tree as far as it is
 * expanded. With one, a flat list of the fields whose name contains `text`
 * and, when `invalidOnly`, that have an error.
 */
export function fieldRows(entry: FormEntry, expanded: ReadonlySet<string>, text: string, invalidOnly: boolean): Row[] {
  if (text === "" && !invalidOnly) return treeRows(entry, (key) => expanded.has(key));
  const needle = text.toLowerCase();
  const rows = invalidOnly
    ? invalidFields(entry.store).map(({ field }) => ({ path: field.path, label: "", depth: 0, snapshot: entry.store.getSnapshot(field.path), branch: false }))
    : treeRows(entry, () => true);
  return rows.map(flat).filter((row) => row.label.toLowerCase().includes(needle));
}

export type Flag = "invalid" | "validating" | "dirty" | "edited" | "touched" | "disabled" | "read-only";

/** What each flag means, as its tooltip and hover card say it. */
export const flagText: Record<Flag, string> = {
  invalid: "Has errors",
  validating: "A validator is running",
  dirty: "Differs from its baseline",
  edited: "Changed by the user since the last reset",
  touched: "Blurred since the last reset",
  disabled: "Disabled, here or above",
  "read-only": "Read-only, here or above",
};

/** The icon each flag shows on a row. */
const flagIcons: Record<Flag, LucideIcon> = {
  invalid: TriangleAlert,
  validating: LoaderCircle,
  dirty: CircleSmall,
  edited: TextCursor,
  touched: Check,
  disabled: Ban,
  "read-only": Lock,
};

const flagBox = "inline-flex items-center justify-center size-5 rounded-sm [&_svg]:size-3";

/** Each flag's icon box: errors in red, the brand colour for work in progress and for a value off its baseline. */
const flagClass: Record<Flag, string> = {
  invalid: `${flagBox} bg-error-tint text-error`,
  validating: `${flagBox} text-brand [&_svg]:animate-spin`,
  dirty: `${flagBox} text-brand [&_svg]:fill-current`,
  edited: `${flagBox} text-soft`,
  touched: `${flagBox} text-soft`,
  disabled: `${flagBox} text-soft`,
  "read-only": `${flagBox} text-soft`,
};

/** Every flag in the order rows show them, each in its own slot. `dirty` gets a slot only when the form has `dirty()`. */
const flagOrder: readonly Flag[] = ["invalid", "validating", "dirty", "edited", "touched", "disabled", "read-only"];

/** The flags a field has set, in the order rows show them. `dirty` only counts when the form has `dirty()`. */
export function flagsOf(snapshot: Snapshot, dirty: boolean): Flag[] {
  const flags: Flag[] = [];
  if (snapshot.invalid) flags.push("invalid");
  if (snapshot.validating) flags.push("validating");
  if (dirty && "dirty" in snapshot && snapshot.dirty === true) flags.push("dirty");
  if (snapshot.edited) flags.push("edited");
  if (snapshot.touched) flags.push("touched");
  if (snapshot.disabled) flags.push("disabled");
  if (snapshot.readOnly) flags.push("read-only");
  return flags;
}

export interface ErrorViewProps {
  readonly error: unknown;
}

/** An error's text, or its code linked to the errors page. */
export function ErrorView({ error }: ErrorViewProps): JSX.Element {
  const shown = readError(error);
  return shown.code === undefined
    ? <span class="min-w-0 text-error [overflow-wrap:anywhere]">{shown.text}</span>
    : <a href={`${errorsPage}${shown.code}`} target="_blank" rel="noreferrer">{shown.code}</a>;
}

/** What `errorsByKind` and the snapshot say about where a field's errors came from. */
export function errorSources(entry: FormEntry, path: Path, snapshot: Snapshot): (readonly [source: string, errors: readonly unknown[]])[] {
  const kinds = errorsByKind({ store: entry.store, path });
  const sources = [
    ["schema", kinds.schema],
    ["form validator", kinds.form],
    ["field validator", kinds.field],
    ["setErrors", snapshot.userErrors],
  ] as const;
  return sources.filter(([, errors]) => errors.length > 0);
}

const flagWrites = new Set(["touched", "disabled", "readOnly"]);

/** The value writes logged at `path`, array commands included, newest first. Flag writes such as `touched` are left out. */
export function writesAt(entry: FormEntry, path: Path, max = 5): LoggedWrite[] {
  const key = pathKey(path);
  const { items } = entry.writes;
  const found: LoggedWrite[] = [];
  for (let index = items.length - 1; index >= 0 && found.length < max; index--) {
    const write = items[index];
    if (write && !flagWrites.has(write.record.type) && pathKey(write.record.path) === key) found.push(write);
  }
  return found;
}

/** A card's list of terms and descriptions. */
export const facts = "flex flex-col gap-1.5 py-3 px-4 empty:hidden";

/** The head of a field card: the field's name, then buttons. */
export const detailHead = "flex items-center gap-2 h-11 pr-3 pl-4 border-b border-line";
export const detailName = "flex-1 font-medium truncate";

const termClass = "shrink-0 min-w-16 whitespace-nowrap font-sans text-xs/5 text-muted";
const factClass = "flex gap-3 min-w-0";

export interface FactProps {
  readonly term: string;
  readonly children?: ComponentChildren;
}

/** A term and its description, one line of a card. */
export function Fact({ term, children }: FactProps): JSX.Element {
  return (
    <div class={factClass}>
      <span class={termClass}>{term}</span>
      {children}
    </div>
  );
}

/** How many characters at the end of a value stay readable when its middle gives way. */
const tailLength = 6;

interface ValueProps {
  /** The value's text, in full. */
  readonly text: string;
  readonly muted?: boolean;
}

/**
 * A value on one line of a card. When it doesn't fit, its middle gives way to
 * an ellipsis, so its start and its end stay readable, and the tooltip shows
 * it whole. The card never scrolls sideways.
 */
export function Value({ text, muted = false }: ValueProps): JSX.Element {
  const split = text.length > 2 * tailLength;
  const head = split ? text.slice(0, -tailLength) : text;
  return (
    <span class={`flex min-w-0 whitespace-nowrap${split ? "" : " shrink-0"}${muted ? " text-muted" : ""}`} data-tip={text} data-tip-clipped="">
      <span class="truncate">{head}</span>
      {split ? <span class="shrink-0">{text.slice(-tailLength)}</span> : null}
    </span>
  );
}

/** The most of a value a card's line shows, and its tooltip with it. */
const cardMax = 2000;

interface WriteLineProps {
  readonly write: LoggedWrite;
}

/** One logged write: before → after and its cause, or what kind of write it was. */
function WriteLine({ write: { record } }: WriteLineProps): JSX.Element {
  return (
    <div class="write flex flex-1 items-center gap-2 min-w-0 whitespace-nowrap">
      {record.type === "value" ? (
        <>
          <Value muted text={preview(record.before, cardMax)} />
          <ArrowRight class="size-3.5 text-muted" />
          <Value text={preview(record.after, cardMax)} />
        </>
      ) : (
        <Value text={`${record.type} ${preview(record.after, cardMax)}`} />
      )}
      <span class="shrink-0 ml-auto pl-2 font-sans text-muted">{causeText(record.cause)}</span>
    </div>
  );
}

interface FieldProps {
  readonly entry: FormEntry;
  readonly path: Path;
  readonly snapshot: Snapshot;
}

/** The value against the baseline, two lines of a card. */
function ValueFacts({ entry, path, snapshot }: FieldProps): JSX.Element {
  const baseline = entry.ctx.baseline.read(path);
  return (
    <>
      <Fact term="value">
        <Value text={preview(snapshot.value, cardMax)} />
      </Fact>
      <Fact term="baseline">
        <Value muted text={baseline === undefined ? "none" : preview(baseline.value, cardMax)} />
      </Fact>
    </>
  );
}

export type FieldFactsProps = FieldProps;

/** A field card's body: value and baseline, then the writes at the field. */
export function FieldFacts({ entry, path, snapshot }: FieldFactsProps): JSX.Element {
  const writes = writesAt(entry, path);
  return (
    <>
      <div class={facts}>
        <ValueFacts entry={entry} path={path} snapshot={snapshot} />
      </div>
      <div class={`${facts} border-t border-line`}>
        <div class={factClass}>
          <span class={termClass}>writes</span>
          <div class="flex flex-1 flex-col gap-1.5 min-w-0">
            {writes.length === 0 ? <span class="text-muted">none logged</span> : writes.map((write) => <WriteLine key={write.seq} write={write} />)}
          </div>
        </div>
      </div>
    </>
  );
}

interface FlagDetailProps extends FieldProps {
  readonly flag: Flag;
}

/** The detail a flag's hover card shows under its meaning. */
function FlagDetail({ entry, path, snapshot, flag }: FlagDetailProps): JSX.Element | null {
  if (flag === "dirty") return <ValueFacts entry={entry} path={path} snapshot={snapshot} />;
  if (flag === "invalid")
    return (
      <>
        {errorSources(entry, path, snapshot).flatMap(([source, errors]) =>
          errors.map((error, index) => (
            <Fact key={`${source}${index}`} term={index === 0 ? source : ""}>
              <ErrorView error={error} />
            </Fact>
          )),
        )}
      </>
    );
  if (flag === "edited") {
    const [last] = writesAt(entry, path, 1);
    return last ? (
      <Fact term={clock(last.at)}>
        <WriteLine write={last} />
      </Fact>
    ) : null;
  }
  return null;
}

/** A flag pointed at, and where its icon is. */
interface Hint {
  readonly path: Path;
  readonly flag: Flag;
  readonly rect: DOMRect;
}

interface FlagCardProps extends Hint {
  readonly entry: FormEntry;
}

/** A flag's hover card: what the flag means and its detail, fixed next to the icon. */
function FlagCard({ entry, path, flag, rect }: FlagCardProps): JSX.Element {
  const snapshot = entry.store.getSnapshot(path);
  // Under the icon, or over it when the icon is low in the window; kept inside the window.
  const below = rect.bottom < innerHeight / 2;
  const right = Math.max(8, innerWidth - rect.right);
  return (
    <div
      class="hovercard fixed z-[2147483002] flex flex-col w-[280px] max-w-[calc(100vw-16px)] pt-3 px-4 pb-0 bg-raised border border-line rounded-lg shadow-panel font-sans text-xs/5 pointer-events-none"
      role="tooltip"
      style={`right: ${right}px; ${below ? `top: ${rect.bottom + 6}px` : `bottom: ${innerHeight - rect.top + 6}px`}`}
    >
      <strong class="font-medium text-sm">
        {flag[0]?.toUpperCase()}
        {flag.slice(1)}
      </strong>
      <span class="text-muted">{flagText[flag]}</span>
      <div class="flex flex-col gap-1.5 pt-2 pb-3 empty:hidden">
        <FlagDetail entry={entry} path={path} snapshot={snapshot} flag={flag} />
      </div>
    </div>
  );
}

interface ShowButtonProps {
  /** In a row, the button shows only while the row is hovered. */
  readonly inRow?: boolean;
  readonly path: Path;
  readonly name: string;
  readonly onInspect: (path: Path) => void;
}

/** The button that shows a field's elements on the page. */
function ShowButton({ inRow = false, path, name, onInspect }: ShowButtonProps): JSX.Element {
  return (
    <IconButton
      label={`Show ${name} on the page`}
      icon={MousePointer2}
      class={`${smallBox} ${iconTone}${inRow ? " bg-raised hover:bg-raised invisible group-hover:visible" : ""}`}
      data-tip="Show on the page"
      onClick={() => onInspect(path)}
    />
  );
}

interface FilterBoxProps {
  readonly filter: string;
  readonly onFilter: (text: string) => void;
  readonly invalidOnly: boolean;
  readonly onInvalidOnly: (on: boolean) => void;
}

/** The filter box over the tree, with the toggle for fields with errors. */
function FilterBox({ filter, onFilter, invalidOnly, onInvalidOnly }: FilterBoxProps): JSX.Element {
  return (
    <div class="flex shrink-0 items-center gap-2 h-10 pr-2 pl-4 border-b border-line text-muted">
      <Search class="size-3.5" />
      <input
        class="flex-1 min-w-0 h-full border-0 bg-transparent font-sans text-sm leading-[normal] text-fg outline-none"
        type="search" placeholder="Filter" aria-label="Filter fields by name" value={filter} onInput={(event) => onFilter(event.currentTarget.value)} />
      <IconButton
        label="Only fields with errors"
        icon={TriangleAlert}
        class={`${smallBox} text-soft hover:bg-hover hover:text-fg aria-pressed:bg-error-tint aria-pressed:text-error`}
        aria-pressed={invalidOnly ? "true" : "false"}
        onClick={() => onInvalidOnly(!invalidOnly)}
      />
    </div>
  );
}

interface FlagIconProps {
  readonly flag: Flag;
  /** Called with the icon's place while it is pointed at or focused, and with null when that ends. */
  readonly onHint: (rect: DOMRect | null) => void;
}

/** One flag on a row, which shows its hover card while pointed at or focused. */
function FlagIcon({ flag, onHint }: FlagIconProps): JSX.Element {
  const FlagGlyph = flagIcons[flag];
  const show = (event: { currentTarget: Element }) => onHint(event.currentTarget.getBoundingClientRect());
  return (
    <span
      class={`flag ${flag} ${flagClass[flag]}`}
      tabIndex={0}
      role="img"
      aria-label={`${flag}: ${flagText[flag]}`}
      onPointerEnter={show}
      onFocus={show}
      onPointerLeave={() => onHint(null)}
      onBlur={() => onHint(null)}
    >
      <FlagGlyph />
    </span>
  );
}

interface FieldRowProps {
  readonly row: Row;
  readonly open: boolean;
  readonly selected: boolean;
  readonly dirty: boolean;
  readonly onToggle: () => void;
  readonly onSelect: () => void;
  readonly onHover?: ((path: Path | null) => void) | undefined;
  readonly onInspect?: ((path: Path) => void) | undefined;
  readonly onHint: (hint: Hint | null) => void;
}

/** One row of the tree: its twisty, its label and value, the show button and its flags. */
function FieldRow({ row, open, selected, dirty, onToggle, onSelect, onHover, onInspect, onHint }: FieldRowProps): JSX.Element {
  const key = pathKey(row.path);
  const name = row.snapshot.name || row.label;
  const set = new Set(flagsOf(row.snapshot, dirty));
  return (
    <li
      class="group flex items-center gap-1.5 h-7 pr-3 pl-[calc(12px+var(--depth,0)*16px)] hover:bg-row-hover aria-[current=true]:bg-active aria-[current=true]:shadow-[inset_2px_0_var(--color-brand)]"
      style={`--depth: ${row.depth}`}
      data-path={key}
      aria-current={selected ? "true" : undefined}
      onPointerEnter={() => onHover?.(row.path)}
      onPointerLeave={() => onHover?.(null)}
    >
      {row.branch ? (
        <IconButton label={`${open ? "Collapse" : "Expand"} ${name}`} icon={ChevronDown}
          class="inline-flex shrink-0 items-center justify-center w-4 h-5 rounded-sm text-muted [&_svg]:size-3.5 [&[aria-expanded=false]_svg]:-rotate-90" aria-expanded={open ? "true" : "false"} onClick={onToggle} />
      ) : (
        <span class="shrink-0 w-4" />
      )}
      <button class="row-main flex-1 min-w-0 text-left truncate" onClick={onSelect}>
        {row.label} <span class="text-muted">{preview(row.snapshot.value)}</span>
      </button>
      {onInspect ? <ShowButton inRow path={row.path} name={name} onInspect={onInspect} /> : null}
      {/* Every flag has a slot of its own, set or not, so nothing on the row moves when a flag comes or goes. */}
      <span class="flex shrink-0 gap-0.5">
        {flagOrder.map((flag) =>
          flag === "dirty" && !dirty ? null : set.has(flag) ? (
            <FlagIcon key={flag} flag={flag} onHint={(rect) => onHint(rect ? { path: row.path, flag, rect } : null)} />
          ) : (
            <span key={flag} class="size-5" />
          ),
        )}
      </span>
    </li>
  );
}

interface FieldDetailProps extends FieldProps {
  readonly onClose: () => void;
  readonly onInspect?: ((path: Path) => void) | undefined;
}

/** The selected field's card under the tree. */
function FieldDetail({ entry, path, snapshot, onClose, onInspect }: FieldDetailProps): JSX.Element {
  return (
    <section class={`${scroll} flex-[0_0_auto] max-h-1/2 overflow-x-hidden border-t border-line`} aria-label="Field detail">
      <div class={detailHead}>
        <strong class={detailName}>{snapshot.name || "(form)"}</strong>
        {onInspect ? <ShowButton path={path} name={snapshot.name} onInspect={onInspect} /> : null}
        <IconButton label="Close the field detail" icon={X} class={`${smallBox} ${iconTone}`} onClick={onClose} />
      </div>
      <FieldFacts entry={entry} path={path} snapshot={snapshot} />
    </section>
  );
}

export interface FieldsProps {
  readonly entry: FormEntry;
  readonly expanded: ReadonlySet<string>;
  /** Expands or collapses the row whose path has key `key`. */
  readonly onToggle: (key: string) => void;
  /** The selected row's path. */
  readonly row: Path | null;
  readonly onRow: (path: Path | null) => void;
  /** The filter box's text. */
  readonly filter: string;
  readonly onFilter: (text: string) => void;
  readonly invalidOnly: boolean;
  readonly onInvalidOnly: (on: boolean) => void;
  /** Called with a row's path while the pointer is over it, and with null when it leaves. */
  readonly onHover?: ((path: Path | null) => void) | undefined;
  /** Shows a field's elements on the page. Unset when the form records no elements. */
  readonly onInspect?: ((path: Path) => void) | undefined;
}

/** The Fields tab: a filter box, the value tree with each field's flags, and the selected field's card. */
export function Fields({ entry, expanded, onToggle, row, onRow, filter, onFilter, invalidOnly, onInvalidOnly, onHover, onInspect }: FieldsProps): JSX.Element {
  const rows = fieldRows(entry, expanded, filter, invalidOnly);
  const dirty = hasPlugin(entry, "dirty");
  const selectedKey = row && pathKey(row);
  const selected = row && entry.store.getSnapshot(row);
  const [hint, setHint] = useState<Hint | null>(null);
  useFrame(() => {
    const reads: unknown[] = fieldRows(entry, expanded, filter, invalidOnly).map((item) => item.snapshot);
    // The card also shows the baseline and the writes, which no snapshot carries.
    for (const path of [row, hint?.path]) if (path) reads.push(entry.store.getSnapshot(path), entry.ctx.baseline.read(path)?.value, entry.lastWrite.get(pathKey(path)));
    return reads;
  });
  return (
    <>
      <FilterBox filter={filter} onFilter={onFilter} invalidOnly={invalidOnly} onInvalidOnly={onInvalidOnly} />
      <ul class={`${scroll} flex-[1_1_auto] m-0 py-2 px-0 list-none`} aria-label="Fields" onScroll={() => setHint(null)}>
        {rows.length === 0 ? (
          <li class={empty}>{invalidOnly ? "No field has an error." : filter ? "No field matches." : "The form has no fields."}</li>
        ) : (
          rows.map((item) => {
            const key = pathKey(item.path);
            return (
              <FieldRow
                key={key}
                row={item}
                open={expanded.has(key)}
                selected={key === selectedKey}
                dirty={dirty}
                onToggle={() => onToggle(key)}
                onSelect={() => onRow(key === selectedKey ? null : item.path)}
                onHover={onHover}
                onInspect={onInspect}
                onHint={setHint}
              />
            );
          })
        )}
      </ul>
      {hint ? <FlagCard entry={entry} {...hint} /> : null}
      {row && selected ? <FieldDetail entry={entry} path={row} snapshot={selected} onClose={() => onRow(null)} onInspect={onInspect} /> : null}
    </>
  );
}
