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
import { IconButton } from "./icons.js";
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
    ? <span class="error">{shown.text}</span>
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

export interface FactProps {
  readonly term: string;
  readonly children?: ComponentChildren;
}

/** A term and its description, one line of a card. */
export function Fact({ term, children }: FactProps): JSX.Element {
  return (
    <div class="fact">
      <span class="term">{term}</span>
      {children}
    </div>
  );
}

interface WriteLineProps {
  readonly write: LoggedWrite;
}

/** One logged write: before → after and its cause, or what kind of write it was. */
function WriteLine({ write: { record } }: WriteLineProps): JSX.Element {
  return (
    <div class="write">
      {record.type === "value" ? (
        <>
          <span class="muted">{preview(record.before)}</span>
          <ArrowRight />
          {preview(record.after)}
        </>
      ) : (
        `${record.type} ${preview(record.after)}`
      )}
      <span class="cause">{causeText(record.cause)}</span>
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
        <span class="truncate">{preview(snapshot.value)}</span>
      </Fact>
      <Fact term="baseline">
        <span class="muted truncate">{baseline === undefined ? "none" : preview(baseline.value)}</span>
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
      <div class="facts">
        <ValueFacts entry={entry} path={path} snapshot={snapshot} />
      </div>
      <div class="facts">
        <div class="fact">
          <span class="term">writes</span>
          <div class="writes">
            {writes.length === 0 ? <span class="muted">none logged</span> : writes.map((write) => <WriteLine key={write.seq} write={write} />)}
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
    <div class="hovercard surface" role="tooltip" style={`right: ${right}px; ${below ? `top: ${rect.bottom + 6}px` : `bottom: ${innerHeight - rect.top + 6}px`}`}>
      <strong>
        {flag[0]?.toUpperCase()}
        {flag.slice(1)}
      </strong>
      <span class="muted">{flagText[flag]}</span>
      <div class="facts">
        <FlagDetail entry={entry} path={path} snapshot={snapshot} flag={flag} />
      </div>
    </div>
  );
}

interface ShowButtonProps {
  readonly path: Path;
  readonly name: string;
  readonly onInspect: (path: Path) => void;
}

/** The button that shows a field's elements on the page. */
function ShowButton({ path, name, onInspect }: ShowButtonProps): JSX.Element {
  return <IconButton label={`Show ${name} on the page`} icon={MousePointer2} class="icon small" data-tip="Show on the page" onClick={() => onInspect(path)} />;
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
    <div class="filter">
      <Search />
      <input type="search" placeholder="Filter" aria-label="Filter fields by name" value={filter} onInput={(event) => onFilter(event.currentTarget.value)} />
      <IconButton
        label="Only fields with errors"
        icon={TriangleAlert}
        class="icon small"
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
      class={`flag ${flag}`}
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
  return (
    <li
      class="row"
      style={`--depth: ${row.depth}`}
      data-path={key}
      aria-current={selected ? "true" : undefined}
      onPointerEnter={() => onHover?.(row.path)}
      onPointerLeave={() => onHover?.(null)}
    >
      {row.branch ? (
        <IconButton label={`${open ? "Collapse" : "Expand"} ${name}`} icon={ChevronDown} class="twisty" aria-expanded={open ? "true" : "false"} onClick={onToggle} />
      ) : (
        <span class="leaf" />
      )}
      <button class="row-main truncate" onClick={onSelect}>
        {row.label} <span class="muted">{preview(row.snapshot.value)}</span>
      </button>
      {onInspect ? <ShowButton path={row.path} name={name} onInspect={onInspect} /> : null}
      <span class="flags">
        {flagsOf(row.snapshot, dirty).map((flag) => (
          <FlagIcon key={flag} flag={flag} onHint={(rect) => onHint(rect ? { path: row.path, flag, rect } : null)} />
        ))}
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
    <section class="detail scroll" aria-label="Field detail">
      <div class="detail-head">
        <strong class="truncate">{snapshot.name || "(form)"}</strong>
        {onInspect ? <ShowButton path={path} name={snapshot.name} onInspect={onInspect} /> : null}
        <IconButton label="Close the field detail" icon={X} class="icon small" onClick={onClose} />
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
      <ul class="tree scroll" aria-label="Fields" onScroll={() => setHint(null)}>
        {rows.length === 0 ? (
          <li class="empty">{invalidOnly ? "No field has an error." : filter ? "No field matches." : "The form has no fields."}</li>
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
