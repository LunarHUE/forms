import { errorsByKind, type FieldSnapshot, invalidFields, type Path } from "@lunarhue/forms-core";
import { Fragment, h, type JSX } from "preact";
import { useState } from "preact/hooks";
import type { FormEntry, LoggedWrite } from "../hook.js";
import { hasPlugin } from "./forms.js";
import { useFrame } from "./frame.js";
import { icon, iconButton } from "./icons.js";
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

/** An error's text, or its code linked to the errors page. */
export function errorView(error: unknown): JSX.Element {
  const shown = readError(error);
  return shown.code === undefined
    ? h("span", { class: "error" }, shown.text)
    : h("a", { href: `${errorsPage}${shown.code}`, target: "_blank", rel: "noreferrer" }, shown.code);
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

/** A term and its description, one line of a card. */
export const fact = (term: string, ...description: (JSX.Element | string | null)[]) =>
  h("div", { class: "fact", key: term }, h("span", { class: "term" }, term), ...description);

/** One logged write: before → after and its cause, or what kind of write it was. */
const writeLine = ({ seq, record }: LoggedWrite) =>
  h(
    "div",
    { class: "write", key: seq },
    record.type === "value"
      ? [h("span", { class: "muted" }, preview(record.before)), icon("arrow"), preview(record.after)]
      : `${record.type} ${preview(record.after)}`,
    h("span", { class: "cause" }, causeText(record.cause)),
  );

/** The value against the baseline, two lines of a card. */
function valueFacts(entry: FormEntry, path: Path, snapshot: Snapshot): JSX.Element[] {
  const baseline = entry.ctx.baseline.read(path);
  return [
    fact("value", h("span", { class: "truncate" }, preview(snapshot.value))),
    fact("baseline", h("span", { class: "muted truncate" }, baseline === undefined ? "none" : preview(baseline.value))),
  ];
}

/** A field card's body: value and baseline, then the writes at the field. */
export function fieldFacts(entry: FormEntry, path: Path, snapshot: Snapshot): JSX.Element {
  const writes = writesAt(entry, path);
  return h(
    Fragment,
    null,
    h("div", { class: "facts" }, valueFacts(entry, path, snapshot)),
    h(
      "div",
      { class: "facts" },
      h("div", { class: "fact" }, h("span", { class: "term" }, "writes"), h("div", { class: "writes" }, writes.length === 0 ? h("span", { class: "muted" }, "none logged") : writes.map(writeLine))),
    ),
  );
}

/** The detail a flag's hover card shows under its meaning. */
function flagDetail(entry: FormEntry, path: Path, snapshot: Snapshot, flag: Flag): JSX.Element | JSX.Element[] | null {
  if (flag === "dirty") return valueFacts(entry, path, snapshot);
  if (flag === "invalid")
    return errorSources(entry, path, snapshot).flatMap(([source, errors]) =>
      errors.map((error, index) => h("div", { class: "fact", key: `${source}${index}` }, h("span", { class: "term" }, index === 0 ? source : ""), errorView(error))),
    );
  if (flag === "edited") {
    const [last] = writesAt(entry, path, 1);
    return last ? fact(clock(last.at), writeLine(last)) : null;
  }
  return null;
}

/** A flag's hover card: what the flag means and its detail, fixed next to the icon. */
function FlagCard({ entry, path, flag, rect }: { readonly entry: FormEntry; readonly path: Path; readonly flag: Flag; readonly rect: DOMRect }): JSX.Element {
  const snapshot = entry.store.getSnapshot(path);
  // Under the icon, or over it when the icon is low in the window; kept inside the window.
  const below = rect.bottom < innerHeight / 2;
  const right = Math.max(8, innerWidth - rect.right);
  return h(
    "div",
    {
      class: "hovercard surface",
      role: "tooltip",
      style: `right: ${right}px; ${below ? `top: ${rect.bottom + 6}px` : `bottom: ${innerHeight - rect.top + 6}px`}`,
    },
    h("strong", null, flag[0]?.toUpperCase(), flag.slice(1)),
    h("span", { class: "muted" }, flagText[flag]),
    h("div", { class: "facts" }, flagDetail(entry, path, snapshot, flag)),
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
export function Fields(props: FieldsProps): JSX.Element {
  const { entry, expanded, row, filter, invalidOnly, onInspect } = props;
  const rows = fieldRows(entry, expanded, filter, invalidOnly);
  const dirty = hasPlugin(entry, "dirty");
  const selectedKey = row && pathKey(row);
  const selected = row && entry.store.getSnapshot(row);
  const [hint, setHint] = useState<{ readonly path: Path; readonly flag: Flag; readonly rect: DOMRect } | null>(null);
  useFrame(() => {
    const reads: unknown[] = fieldRows(entry, expanded, filter, invalidOnly).map((item) => item.snapshot);
    // The card also shows the baseline and the writes, which no snapshot carries.
    for (const path of [row, hint?.path]) if (path) reads.push(entry.store.getSnapshot(path), entry.ctx.baseline.read(path)?.value, entry.lastWrite.get(pathKey(path)));
    return reads;
  });
  const inspect = (path: Path, name: string) =>
    onInspect ? iconButton(`Show ${name} on the page`, "pointer", { class: "icon small", "data-tip": "Show on the page", onClick: () => onInspect(path) }) : null;
  return h(
    Fragment,
    null,
    h(
      "div",
      { class: "filter" },
      icon("search"),
      h("input", {
        type: "search",
        placeholder: "Filter",
        "aria-label": "Filter fields by name",
        value: filter,
        onInput: (event) => props.onFilter(event.currentTarget.value),
      }),
      iconButton("Only fields with errors", "invalid", {
        class: "icon small",
        "aria-pressed": invalidOnly ? "true" : "false",
        onClick: () => props.onInvalidOnly(!invalidOnly),
      }),
    ),
    h(
      "ul",
      { class: "tree scroll", "aria-label": "Fields", onScroll: () => setHint(null) },
      rows.length === 0
        ? h("li", { class: "empty" }, invalidOnly ? "No field has an error." : filter ? "No field matches." : "The form has no fields.")
        : rows.map((item) => {
            const key = pathKey(item.path);
            const open = expanded.has(key);
            const name = item.snapshot.name || item.label;
            return h(
              "li",
              {
                key,
                class: "row",
                style: `--depth: ${item.depth}`,
                "data-path": key,
                "aria-current": key === selectedKey ? "true" : undefined,
                onPointerEnter: () => props.onHover?.(item.path),
                onPointerLeave: () => props.onHover?.(null),
              },
              item.branch
                ? iconButton(`${open ? "Collapse" : "Expand"} ${name}`, "chevron", {
                    class: "twisty",
                    "aria-expanded": open ? "true" : "false",
                    onClick: () => props.onToggle(key),
                  })
                : h("span", { class: "leaf" }),
              h(
                "button",
                { class: "row-main truncate", onClick: () => props.onRow(key === selectedKey ? null : item.path) },
                item.label,
                " ",
                h("span", { class: "muted" }, preview(item.snapshot.value)),
              ),
              inspect(item.path, name),
              h(
                "span",
                { class: "flags" },
                flagsOf(item.snapshot, dirty).map((flag) => {
                  const show = (event: { currentTarget: Element }) => setHint({ path: item.path, flag, rect: event.currentTarget.getBoundingClientRect() });
                  return h(
                    "span",
                    {
                      key: flag,
                      class: `flag ${flag}`,
                      tabIndex: 0,
                      role: "img",
                      "aria-label": `${flag}: ${flagText[flag]}`,
                      onPointerEnter: show,
                      onFocus: show,
                      onPointerLeave: () => setHint(null),
                      onBlur: () => setHint(null),
                    },
                    icon(flag),
                  );
                }),
              ),
            );
          }),
    ),
    hint ? h(FlagCard, { entry, ...hint }) : null,
    row && selected
      ? h(
          "section",
          { class: "detail scroll", "aria-label": "Field detail" },
          h(
            "div",
            { class: "detail-head" },
            h("strong", { class: "truncate" }, selected.name || "(form)"),
            inspect(row, selected.name),
            iconButton("Close the field detail", "close", { class: "icon small", onClick: () => props.onRow(null) }),
          ),
          fieldFacts(entry, row, selected),
        )
      : null,
  );
}
