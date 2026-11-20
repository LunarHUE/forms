import { errorsByKind, type FieldSnapshot, invalidFields, type Path } from "@lunarhue/forms-core";
import { Fragment, h, type JSX } from "preact";
import type { FormEntry } from "../hook.js";
import { hasPlugin } from "./forms.js";
import { useFrame } from "./frame.js";
import { icon } from "./icons.js";
import { causeText, clock, errorsPage, format, pathKey, preview, readError, shapeOf } from "./values.js";

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
 * expanded row. Reading a path makes its node in the store, so the walk
 * never leaves what is expanded. The root shows as a row of its own only
 * while it has errors, which are the form's.
 */
export function treeRows(entry: FormEntry, expanded: ReadonlySet<string>): Row[] {
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
      if (branch && expanded.has(pathKey(child))) visit(child, childSnapshot, depth + 1);
    }
  };
  visit([], root, 0);
  return rows;
}

/** Every field with an error, flat and in value order, for the "invalid only" filter. */
export function invalidRows(entry: FormEntry): Row[] {
  return invalidFields(entry.store).map(({ field, name }) => ({
    path: field.path,
    label: name === "" ? "(form)" : name,
    depth: 0,
    snapshot: entry.store.getSnapshot(field.path),
    branch: false,
  }));
}

/** The flags a field has set, in the order rows show them. `dirty` only counts when the form has `dirty()`. */
export function flagsOf(snapshot: Snapshot, dirty: boolean): string[] {
  const flags: string[] = [];
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

export interface FieldsProps {
  readonly entry: FormEntry;
  readonly expanded: ReadonlySet<string>;
  /** Expands or collapses the row whose path has key `key`. */
  readonly onToggle: (key: string) => void;
  /** The selected row's path. */
  readonly row: Path | null;
  readonly onRow: (path: Path | null) => void;
  readonly invalidOnly: boolean;
  readonly onInvalidOnly: (on: boolean) => void;
  /** Called with a row's path while the pointer is over it, and with null when it leaves. */
  readonly onHover?: ((path: Path | null) => void) | undefined;
}

/** The Fields tab: the value tree with each field's flags, and the selected field's detail. */
export function Fields(props: FieldsProps): JSX.Element {
  const { entry, expanded, row, invalidOnly } = props;
  const rows = invalidOnly ? invalidRows(entry) : treeRows(entry, expanded);
  const dirty = hasPlugin(entry, "dirty");
  const selectedKey = row && pathKey(row);
  const selected = row && entry.store.getSnapshot(row);
  useFrame(() => {
    const now = invalidOnly ? invalidRows(entry) : treeRows(entry, expanded);
    const reads: unknown[] = now.map((item) => item.snapshot);
    // The detail also shows the baseline and the last write, which no snapshot carries.
    if (row) reads.push(entry.store.getSnapshot(row), entry.ctx.baseline.read(row)?.value, entry.lastWrite.get(pathKey(row)));
    return reads;
  });
  return h(
    Fragment,
    null,
    h(
      "div",
      { class: "toolbar" },
      h(
        "label",
        null,
        h("input", {
          type: "checkbox",
          checked: invalidOnly,
          onChange: (event) => props.onInvalidOnly(event.currentTarget.checked),
        }),
        "Invalid only",
      ),
      h("span", { class: "count" }, rows.length === 1 ? "1 field" : `${rows.length} fields`),
    ),
    h(
      "ul",
      { class: "tree scroll", "aria-label": "Fields" },
      rows.length === 0
        ? h("li", { class: "empty" }, invalidOnly ? "No field has an error." : "The form has no fields.")
        : rows.map((item) => {
            const key = pathKey(item.path);
            const open = expanded.has(key);
            const flags = flagsOf(item.snapshot, dirty);
            const [first] = item.snapshot.errors;
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
                ? h(
                    "button",
                    {
                      class: "twisty",
                      "aria-expanded": open ? "true" : "false",
                      "aria-label": `${open ? "Collapse" : "Expand"} ${item.snapshot.name || item.label}`,
                      onClick: () => props.onToggle(key),
                    },
                    icon("chevron"),
                  )
                : h("span", { class: "leaf" }),
              h(
                "button",
                { class: "row-main", onClick: () => props.onRow(key === selectedKey ? null : item.path) },
                h("span", { class: "row-name truncate" }, item.label, " ", h("span", { class: "row-value" }, preview(item.snapshot.value))),
                h(
                  "span",
                  { class: "flags" },
                  flags.map((flag) => h("span", { key: flag, class: `flag-${flag}` }, flag)),
                ),
                first === undefined ? null : h("span", { class: "row-error" }, errorView(first)),
              ),
            );
          }),
    ),
    row && selected ? h(Detail, { entry, path: row, snapshot: selected, dirty, onClose: () => props.onRow(null) }) : null,
  );
}

interface DetailProps {
  readonly entry: FormEntry;
  readonly path: Path;
  readonly snapshot: Snapshot;
  readonly dirty: boolean;
  readonly onClose: () => void;
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

/** A term and its description, for a `<dl>`. */
const fact = (term: string, description: JSX.Element | string) => [h("dt", { key: `${term}-t` }, term), h("dd", { key: `${term}-d` }, description)];

/** The facts about one field, as a list of terms and descriptions. */
export function fieldFacts(entry: FormEntry, path: Path, snapshot: Snapshot, dirty: boolean): JSX.Element[] {
  const { ctx } = entry;
  const baseline = ctx.baseline.read(path);
  const display = snapshot.meta?.["~display"];
  const sources = errorSources(entry, path, snapshot);
  const attachments = ctx.attachments(path);
  const seq = entry.lastWrite.get(pathKey(path));
  const write = seq === undefined ? undefined : entry.writes.items.find((logged) => logged.seq === seq);
  const flags = flagsOf(snapshot, dirty);
  return [
    ...fact("path", JSON.stringify(path)),
    ...fact("value", h("pre", null, format(snapshot.value))),
    ...fact(
      "baseline",
      baseline === undefined
        ? h("span", { class: "muted" }, "none")
        : ctx.baseline.equals(path, snapshot.value, baseline.value)
          ? h("span", { class: "muted" }, "same as value")
          : h("pre", null, format(baseline.value)),
    ),
    ...(display === undefined ? [] : fact("display", h("pre", null, format(display)))),
    ...fact("flags", flags.length === 0 ? h("span", { class: "muted" }, "none") : flags.join(" ")),
    ...fact(
      "errors",
      sources.length === 0
        ? h("span", { class: "muted" }, "none")
        : h(
            "ul",
            null,
            sources.flatMap(([source, errors]) =>
              errors.map((error, index) => h("li", { key: `${source}${index}` }, h("span", { class: "source" }, `${source} `), errorView(error))),
            ),
          ),
    ),
    ...fact(
      "plugins",
      attachments.length === 0
        ? h("span", { class: "muted" }, "none attached")
        : h(
            "ul",
            null,
            attachments.map((attachment, index) =>
              h(
                "li",
                { key: index },
                attachment.name,
                pathKey(attachment.path) === pathKey(path) ? null : h("span", { class: "muted" }, ` at ${attachment.path.join(".") || "the form"}`),
              ),
            ),
          ),
    ),
    ...fact(
      "last write",
      seq === undefined
        ? h("span", { class: "muted" }, "none logged")
        : write === undefined
          ? `#${seq}`
          : h(
              "span",
              null,
              `#${seq} ${write.record.type} by ${causeText(write.record.cause)} at ${clock(write.at)}`,
              write.record.type === "value" ? h("span", { class: "muted" }, ` ${preview(write.record.before)} → ${preview(write.record.after)}`) : null,
            ),
    ),
  ];
}

/** The selected field's detail under the tree. */
function Detail({ entry, path, snapshot, dirty, onClose }: DetailProps): JSX.Element {
  return h(
    "section",
    { class: "detail scroll", "aria-label": "Field detail" },
    h(
      "div",
      { class: "detail-head" },
      h("strong", { class: "truncate" }, snapshot.name || "(form)"),
      h("button", { class: "icon small", "aria-label": "Close the field detail", onClick: onClose }, icon("close")),
    ),
    h("dl", { class: "facts" }, ...fieldFacts(entry, path, snapshot, dirty)),
  );
}
