import type { AnyFormStore, FieldSnapshot, FormSnapshot, Path } from "@lunarhue/forms-core";
import { restartFlash } from "./flash.js";
import { compactValue, formatErrors, formatSubmission, isPlainObject } from "./format.js";
import { normalDelayMs, type ServerSettings, slowDelayMs } from "./settings.js";

/**
 * Any form store, whatever its value, error, intent and result types. The
 * inspector only reads snapshots and calls commands that take no typed
 * arguments, so every store fits.
 */
export type InspectableStore = AnyFormStore<unknown>;

/** Options for `mountInspector`. */
export interface InspectorOptions {
  /**
   * The fake server's settings. When given, the controls get a "slow
   * network" toggle and a "server rejects next save" toggle that write them.
   */
  readonly settings?: ServerSettings;
  /**
   * A value that breaks the form's rules. When given, the controls get a
   * "fill with invalid data" button that writes it over the whole form as a
   * user edit.
   */
  readonly invalidValue?: unknown;
  /** The most log lines kept. Defaults to 200. */
  readonly logLimit?: number;
}

type Snapshot = FieldSnapshot<unknown, unknown>;

/** The boolean members of a field snapshot, in table order. */
const flagColumns = ["touched", "edited", "dirty", "validating", "disabled", "readOnly", "invalid"] as const;
type FlagColumn = (typeof flagColumns)[number];

const errorColumns = ["errors", "shownErrors"] as const;
type ErrorColumn = (typeof errorColumns)[number];

type Column = "name" | "value" | FlagColumn | ErrorColumn;
const columns: readonly Column[] = ["name", "value", ...flagColumns, ...errorColumns];

/** The members of the form snapshot shown in the state list, in order. */
const formMembers = ["valid", "validating", "dirty", "submitting", "submitCount", "submission"] as const;

/** One field's table row and what it last showed. */
interface Row {
  readonly path: Path;
  readonly element: HTMLTableRowElement;
  readonly cells: Readonly<Record<Column, HTMLTableCellElement>>;
  readonly option: HTMLOptionElement;
  snapshot: Snapshot;
  shape: string;
  unsubscribe: () => void;
}

const rowKey = (path: Path) => JSON.stringify(path);

/** A record with one entry per key, each made by `make`. */
function record<K extends string, T>(keys: readonly K[], make: (key: K) => T): Record<K, T> {
  const out = new Map<K, T>(keys.map((key) => [key, make(key)]));
  // The map has an entry for every key, so the object has every member of Record<K, T>.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.fromEntries(out) as Record<K, T>;
}

/** Sets a cell's text, and flashes it when the text changed and `flash` is true. */
function setText(cell: HTMLElement, text: string, flash = true): void {
  if (cell.textContent === text) return;
  cell.textContent = text;
  if (flash) restartFlash(cell);
}

/** Shows a boolean in a cell, with `.is-true` or `.is-false` for its colour. */
function setFlag(cell: HTMLElement, on: boolean, flash = true): void {
  cell.classList.toggle("is-true", on);
  cell.classList.toggle("is-false", !on);
  setText(cell, String(on), flash);
}

/** The field's name for display. The root's name is empty. */
const displayName = (snapshot: Snapshot) => (snapshot.name === "" ? "(root)" : snapshot.name);

/** What decides which rows sit below a field: its kind and its child keys. */
function shapeOf(snapshot: Snapshot): string {
  const { value } = snapshot;
  if (Array.isArray(value)) return `array ${JSON.stringify(snapshot.keys ?? [])}`;
  if (isPlainObject(value)) return `object ${JSON.stringify(Object.keys(value))}`;
  return "leaf";
}

/** The stable paths of a field's children: item keys for an array, property names for an object. */
function childPaths(path: Path, snapshot: Snapshot): Path[] {
  const { value } = snapshot;
  if (Array.isArray(value)) return (snapshot.keys ?? []).map((key) => [...path, key]);
  if (isPlainObject(value)) return Object.keys(value).map((key) => [...path, key]);
  return [];
}

/**
 * Renders the inspector into `target` and returns the function that removes
 * it and every subscription it made. It only reads the store, through
 * `subscribe` and the snapshot getters, so it never makes the form's own
 * components render. It writes to the store only when one of its controls
 * is used. Call it in the browser; importing this module touches no DOM.
 */
export function mountInspector(target: HTMLElement, store: InspectableStore, options: InspectorOptions = {}): () => void {
  const doc = target.ownerDocument;
  const logLimit = options.logLimit ?? 200;
  const cleanups: (() => void)[] = [];
  let disposed = false;

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
    const element = doc.createElement(tag);
    if (className !== undefined) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const section = (title: string, ...extra: HTMLElement[]) => {
    const element = el("section", "inspector-section");
    const heading = el("h3", "inspector-heading");
    heading.append(el("span", undefined, title), ...extra);
    element.append(heading);
    return element;
  };

  const button = (label: string, onClick: () => void) => {
    const element = el("button", "button button-small", label);
    element.type = "button";
    element.addEventListener("click", onClick);
    return element;
  };

  const root = el("div", "inspector");

  // Form state

  const stateList = el("dl", "inspector-state");
  const stateCells = record(formMembers, (member) => {
    const value = el("dd");
    value.dataset["member"] = member;
    stateList.append(el("dt", undefined, member), value);
    return value;
  });
  const stateSection = section("Form state");
  stateSection.append(stateList);

  const showForm = (form: FormSnapshot<unknown>, flash = true) => {
    for (const member of formMembers) {
      const text = member === "submission" ? formatSubmission(form.submission) : String(form[member]);
      setText(stateCells[member], text, flash);
    }
  };

  // Log

  const log = el("ol", "inspector-log");
  const logSection = section(
    "Log",
    button("Clear", () => log.replaceChildren()),
  );
  logSection.append(log);

  const addLog = (name: string, member: string, change: string) => {
    const line = el("li");
    line.append(el("span", "log-name", name), el("span", "log-member", member), el("span", "log-change", change));
    log.prepend(line);
    while (log.childElementCount > logLimit) log.lastElementChild?.remove();
  };

  // Changes and disabled fields with errors

  const changesList = el("ul", "inspector-list");
  const changesSection = section("Changes");
  changesSection.append(changesList);
  const disabledList = el("ul", "inspector-list");
  const disabledSection = section("Disabled with errors");
  disabledSection.append(disabledList);

  const showList = (list: HTMLElement, lines: readonly string[], empty: string) => {
    const shown = lines.length > 0 ? lines : [empty];
    const current = Array.from(list.children, (child) => child.textContent);
    if (current.length === shown.length && current.every((line, i) => line === shown[i])) return;
    list.replaceChildren(...shown.map((line) => el("li", lines.length > 0 ? undefined : "inspector-empty", line)));
  };

  let listsQueued = false;
  const refreshLists = () => {
    listsQueued = false;
    if (disposed) return;
    const nameOf = (path: Path) => displayName(store.getSnapshot(path));
    showList(
      changesList,
      store.changes().map((change) => `${nameOf(change.path)}: ${compactValue(change.baseline)} → ${compactValue(change.value)}`),
      "No changes",
    );
    showList(
      disabledList,
      store.disabledInvalid().map((entry) => `${entry.name === "" ? "(root)" : entry.name}: ${formatErrors(entry.errors)}`),
      "None",
    );
  };
  // Both lists walk the whole form, so they refresh once after a burst of notifications.
  const queueLists = () => {
    if (listsQueued) return;
    listsQueued = true;
    queueMicrotask(refreshLists);
  };

  // Field table

  const table = el("table", "inspector-table");
  const head = el("thead");
  const headRow = el("tr");
  for (const column of columns) headRow.append(el("th", undefined, column));
  head.append(headRow);
  const body = el("tbody");
  table.append(head, body);
  const tableWrap = el("div", "inspector-table-wrap");
  tableWrap.append(table);
  const fieldsSection = section("Fields");
  fieldsSection.append(tableWrap);

  const rows = new Map<string, Row>();
  const fieldSelect = el("select");
  fieldSelect.setAttribute("aria-label", "Field");

  const fillRow = (row: Row, snapshot: Snapshot, flash = true) => {
    setText(row.cells.name, displayName(snapshot), flash);
    row.option.textContent = displayName(snapshot);
    setText(row.cells.value, compactValue(snapshot.value), flash);
    for (const flag of flagColumns) setFlag(row.cells[flag], snapshot[flag], flash);
    for (const column of errorColumns) setText(row.cells[column], formatErrors(snapshot[column]), flash);
  };

  const createRow = (path: Path): Row => {
    const element = el("tr");
    const cells = record(columns, (column) => {
      const cell = el("td");
      cell.dataset["column"] = column;
      element.append(cell);
      return cell;
    });
    const key = rowKey(path);
    element.dataset["path"] = key;
    const option = el("option");
    option.value = key;
    const snapshot = store.getSnapshot(path);
    const row: Row = { path, element, cells, option, snapshot, shape: shapeOf(snapshot), unsubscribe: () => {} };
    fillRow(row, snapshot, false);
    row.unsubscribe = store.subscribe(path, () => updateRow(row));
    rows.set(key, row);
    return row;
  };

  /** Brings the rows in line with the value: adds, orders and removes rows by walking from the root. */
  const walk = () => {
    const order: Row[] = [];
    const visit = (path: Path) => {
      const row = rows.get(rowKey(path)) ?? createRow(path);
      order.push(row);
      for (const child of childPaths(path, store.getSnapshot(path))) visit(child);
    };
    visit([]);

    const live = new Set(order);
    let cursor = body.firstElementChild;
    for (const row of order) {
      if (row.element === cursor) cursor = cursor.nextElementSibling;
      else body.insertBefore(row.element, cursor);
    }
    for (const [key, row] of rows) {
      if (live.has(row)) continue;
      row.unsubscribe();
      row.element.remove();
      rows.delete(key);
    }

    const selected = fieldSelect.value;
    fieldSelect.replaceChildren(...order.map((row) => row.option));
    if (selected !== "" && rows.has(selected)) fieldSelect.value = selected;
  };

  const updateRow = (row: Row) => {
    const previous = row.snapshot;
    const next = store.getSnapshot(row.path);
    queueLists();
    if (next === previous) return;
    row.snapshot = next;
    const name = displayName(next);

    if (previous.name !== next.name) addLog(name, "name", `${displayName(previous)} → ${name}`);
    const shape = shapeOf(next);
    // Leaves log their value. A container's value changes whenever a child does, and the child logs it.
    if (!Object.is(previous.value, next.value) && shape === "leaf" && row.shape === "leaf") {
      addLog(name, "value", `${compactValue(previous.value)} → ${compactValue(next.value)}`);
    }
    for (const flag of flagColumns) {
      if (previous[flag] !== next[flag]) addLog(name, flag, `${String(previous[flag])} → ${String(next[flag])}`);
    }
    for (const column of errorColumns) {
      const before = formatErrors(previous[column]);
      const after = formatErrors(next[column]);
      if (before !== after) addLog(name, column, `${before === "" ? "none" : before} → ${after === "" ? "none" : after}`);
    }
    const reshaped = shape !== row.shape;
    row.shape = shape;
    if (reshaped && Array.isArray(previous.value) && Array.isArray(next.value)) {
      addLog(name, "keys", `${compactValue(previous.value)} → ${compactValue(next.value)}`);
    }

    fillRow(row, next);
    // Walk again only when an object or array changed shape, so a keystroke patches cells and nothing else.
    if (reshaped) walk();
  };

  // Controls

  const controls = section("Controls");
  const commands = el("div", "inspector-controls");
  commands.append(
    button("Reset", () => store.reset()),
    button("Reset to initial", () => store.reset({ to: "initial" })),
    button("Validate now", () => void store.validate()),
    button("Submit", () => void store.handleSubmit()),
  );
  if ("invalidValue" in options) {
    const { invalidValue } = options;
    commands.append(button("Fill with invalid data", () => store.root.setValue(invalidValue, { replace: true })));
  }
  controls.append(commands);

  const { settings } = options;
  if (settings) {
    const toggles = el("div", "inspector-controls");
    const toggle = (label: string, onChange: (on: boolean) => void) => {
      const wrapper = el("label", "inspector-toggle");
      const input = el("input");
      input.type = "checkbox";
      input.addEventListener("change", () => onChange(input.checked));
      wrapper.append(input, label);
      toggles.append(wrapper);
      return input;
    };
    const slow = toggle("Slow network", (on) => settings.set({ delayMs: on ? slowDelayMs : normalDelayMs }));
    const reject = toggle("Server rejects next save", (on) => settings.set({ reject: on }));
    const showSettings = () => {
      const state = settings.get();
      slow.checked = state.delayMs >= slowDelayMs;
      reject.checked = state.reject;
    };
    showSettings();
    cleanups.push(settings.subscribe(showSettings));
    controls.append(toggles);
  }

  const flags = el("div", "inspector-flags");
  const withField = (fn: (path: Path) => void) => () => {
    const row = rows.get(fieldSelect.value);
    if (row) fn(row.path);
  };
  flags.append(
    fieldSelect,
    button(
      "Toggle disabled",
      withField((path) => store.fieldAt(path)?.setDisabled(!store.getSnapshot(path).disabled)),
    ),
    button(
      "Toggle read-only",
      withField((path) => store.fieldAt(path)?.setReadOnly(!store.getSnapshot(path).readOnly)),
    ),
  );
  controls.append(flags);

  // Assemble and subscribe

  root.append(stateSection, controls, changesSection, disabledSection, fieldsSection, logSection);

  let form = store.getFormSnapshot();
  showForm(form, false);
  cleanups.push(
    store.subscribeForm(() => {
      const previous = form;
      const next = store.getFormSnapshot();
      queueLists();
      if (next === previous) return;
      form = next;
      for (const member of formMembers) {
        if (member === "submission" || previous[member] === next[member]) continue;
        addLog("form", member, `${String(previous[member])} → ${String(next[member])}`);
      }
      const before = previous.submission;
      const after = next.submission;
      if (before !== after) {
        if (after.status === "submitting") addLog("form", "submit", "started");
        else if (before.status === "submitting") addLog("form", "submit", `ended ${formatSubmission(after)}`);
        else addLog("form", "submission", `${before.status} → ${after.status}`);
      }
      showForm(next);
    }),
  );

  walk();
  refreshLists();
  target.append(root);

  return () => {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups) cleanup();
    for (const row of rows.values()) row.unsubscribe();
    rows.clear();
    root.remove();
  };
}
